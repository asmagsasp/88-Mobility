import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, FlatList, Alert, ActivityIndicator, Image, Linking,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { OSMMap } from '../components/OSMMap';
import type { Ride, Location as RideLocation } from '../types';
import type { PassengerRideHistoryItem } from './HistoryScreen';
import {
  publishRideEvent,
  pollRideEvents,
  type SyncRidePayload,
} from '../services/rideSync';

type Step = 'idle' | 'selecting_destination' | 'confirming' | 'searching' | 'active';

export interface AddressSuggestion {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

const RECENT_DESTS_KEY = '@88mobility_recent_destinations';
const PASSENGER_HISTORY_KEY = '@88mobility_passenger_history';

const PRICE_PER_KM = 2.50;
const SURGE_FEE    = 2.00; // Horário de pico (se aplicável)
const PLATFORM_FEE = 2.00; // Taxa de manutenção fixa da plataforma
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cálculo de distância geográfica real em km via fórmula de Haversine
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistance = R * c;
  // Multiplicador 1.25 para simular o trajeto real em vias urbanas
  const roadDistance = straightDistance * 1.25;
  return Math.max(1.2, parseFloat(roadDistance.toFixed(1)));
}

/**
 * Tela Principal do Passageiro 88 Mobility:
 * - Mapa OpenStreetMap com localização ao vivo e motorista Abel visível
 * - Combo com autocompletar dinâmico de endereços via OpenStreetMap Nominatim
 * - Sincronização em tempo real com o app do motorista: a chamada toca na tela do motorista para ele aceitar!
 * - Cálculo transparente de quilometragem e divisão 88/12 + taxa de manutenção
 */
export function HomeScreen() {
  const { passenger, logout } = useAuth();
  const { colors } = useTheme();

  const [coords, setCoords]               = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 });
  const [gpsReady, setGpsReady]           = useState(false);
  const [step, setStep]                   = useState<Step>('idle');
  const [search, setSearch]               = useState('');
  const [isSearchingAddress, setIsSearching] = useState(false);
  const [suggestions, setSuggestions]     = useState<AddressSuggestion[]>([]);
  const [recentDestinations, setRecentDestinations] = useState<AddressSuggestion[]>([]);
  const [destination, setDest]            = useState<AddressSuggestion | null>(null);
  const [activeRide, setActiveRide]       = useState<Partial<Ride> | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  const lastPollTime = useRef<number>(Math.floor(Date.now() / 1000) - 30);

  // Motorista oficial Abel Magalhães posicionado nas proximidades do passageiro
  const driverPos = {
    latitude: coords.lat + 0.0032,
    longitude: coords.lng + 0.0028,
  };

  // Carrega destinos recentes reais do passageiro
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_DESTS_KEY);
        if (stored) {
          setRecentDestinations(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Erro ao carregar destinos recentes:', e);
      }
    })();
  }, []);

  // Solicita permissão e obtém GPS real do dispositivo
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setGpsReady(true);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMounted && loc?.coords) {
          const newCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setCoords(newCoords);
          setGpsReady(true);
        }
      } catch (err) {
        console.warn('Erro ao obter localização do passageiro:', err);
        if (isMounted) setGpsReady(true);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Busca e autocompleta endereços em tempo real conforme o usuário digita
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 3) {
      setSuggestions(recentDestinations);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=6&countrycodes=br`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': '88Mobility-PassengerApp/1.0',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        });
        if (!res.ok) throw new Error('Falha na busca de endereços');
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          const parsed: AddressSuggestion[] = data.map((item: any) => {
            const road = item.address?.road || item.name || item.display_name.split(',')[0];
            const city = item.address?.city || item.address?.town || item.address?.municipality || '';
            const suburb = item.address?.suburb || item.address?.neighbourhood || '';
            const state = item.address?.state || '';
            const sub = [suburb, city, state].filter(Boolean).join(', ') || item.display_name;

            return {
              id: String(item.place_id),
              label: road,
              address: sub,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          setSuggestions(parsed);
        } else {
          setSuggestions([
            {
              id: `custom-${Date.now()}`,
              label: trimmed,
              address: 'Endereço digitado pelo passageiro',
              lat: coords.lat + 0.02,
              lng: coords.lng + 0.02,
            },
          ]);
        }
      } catch (error) {
        console.warn('Erro no autocomplete de endereço:', error);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [search, coords, recentDestinations]);

  // Distância calculada e precificação exata do 88 Mobility
  const distanceKm = destination
    ? getHaversineDistanceKm(coords.lat, coords.lng, destination.lat, destination.lng)
    : 0;
  const kmAmount    = distanceKm * PRICE_PER_KM;
  const totalAmount = kmAmount + SURGE_FEE + PLATFORM_FEE;
  const driverShare = totalAmount * 0.88;

  // Escuta respostas do motorista em tempo real durante a busca ou corrida ativa
  useEffect(() => {
    if (step !== 'searching' && step !== 'active') return;
    if (!currentRideId) return;

    let isPolling = true;

    const interval = setInterval(async () => {
      if (!isPolling) return;
      try {
        const { events, latestTime } = await pollRideEvents(lastPollTime.current);
        lastPollTime.current = latestTime;

        for (const ev of events) {
          if (ev.type === 'ACCEPT_RIDE' && ev.rideId === currentRideId) {
            // Motorista aceitou a chamada!
            setActiveRide({
              id: currentRideId,
              driverName: ev.driver.name,
              driverVehicle: ev.driver.vehicle,
              driverPlate: ev.driver.plate,
              driverRating: ev.driver.rating,
              driverPhone: ev.driver.phone,
              estimatedMinutes: 3,
              totalAmount,
              driverShare,
              platformShare: PLATFORM_FEE,
              status: 'arriving',
            });
            setStep('active');
          } else if (ev.type === 'DECLINE_RIDE' && ev.rideId === currentRideId) {
            // Motorista recusou a chamada
            setStep('confirming');
            Alert.alert(
              'Motorista Indisponível',
              'O motorista Abel Magalhães não pôde aceitar esta chamada no momento. Você pode tentar novamente.'
            );
          } else if (ev.type === 'COMPLETE_RIDE' && ev.rideId === currentRideId) {
            // Motorista finalizou a corrida
            if (destination) {
              const historyItem: PassengerRideHistoryItem = {
                id: currentRideId,
                date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now(),
                origin: 'Sua localização',
                destination: destination.label,
                km: distanceKm,
                total: totalAmount,
                driverName: activeRide?.driverName || 'Abel Magalhães',
                status: 'completed',
              };
              const stored = await AsyncStorage.getItem(PASSENGER_HISTORY_KEY);
              const list: PassengerRideHistoryItem[] = stored ? JSON.parse(stored) : [];
              list.unshift(historyItem);
              await AsyncStorage.setItem(PASSENGER_HISTORY_KEY, JSON.stringify(list));
            }
            Alert.alert('Viagem Concluída! 🎉', `Corrida finalizada pelo motorista. Total: ${formatBRL(totalAmount)}`);
            setActiveRide(null);
            setStep('idle');
            setDest(null);
            setSearch('');
            setCurrentRideId(null);
          }
        }
      } catch (err) {
        console.warn('Erro ao escutar resposta do motorista:', err);
      }
    }, 1500);

    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [step, currentRideId, destination, distanceKm, totalAmount, driverShare, activeRide]);

  const selectDestination = async (item: AddressSuggestion) => {
    setDest(item);
    setSearch(item.label);
    setStep('confirming');

    // Salva nos destinos recentes reais
    try {
      const filtered = recentDestinations.filter(d => d.id !== item.id);
      const updated = [item, ...filtered].slice(0, 5);
      setRecentDestinations(updated);
      await AsyncStorage.setItem(RECENT_DESTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar destino recente:', e);
    }
  };

  // Solicitar corrida: envia a chamada em tempo real para o app do motorista
  const requestRide = async () => {
    if (!destination) return;

    const rideId = `ride-${Date.now()}`;
    setCurrentRideId(rideId);
    setStep('searching');

    const ridePayload: SyncRidePayload = {
      id: rideId,
      passengerName: passenger?.name || 'Passageiro',
      origin: {
        latitude: coords.lat,
        longitude: coords.lng,
        address: 'Sua localização atual',
      },
      destination: {
        latitude: destination.lat,
        longitude: destination.lng,
        address: destination.label,
      },
      distanceKm,
      totalAmount,
      driverShare,
      platformFee: PLATFORM_FEE,
      status: 'requested',
      requestedAt: new Date().toISOString(),
      estimatedMinutes: Math.max(3, Math.round(distanceKm * 2)),
    };

    // Publica a chamada no canal em tempo real
    await publishRideEvent({
      type: 'REQUEST_RIDE',
      ride: ridePayload,
    });
  };

  // Concluir corrida e salvar no histórico real do passageiro
  const completeRide = async () => {
    if (!activeRide || !destination) return;

    if (currentRideId) {
      await publishRideEvent({ type: 'COMPLETE_RIDE', rideId: currentRideId });
    }

    const historyItem: PassengerRideHistoryItem = {
      id: activeRide.id || `ride-${Date.now()}`,
      date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      origin: 'Sua localização',
      destination: destination.label,
      km: distanceKm,
      total: totalAmount,
      driverName: activeRide.driverName || 'Abel Magalhães',
      status: 'completed',
    };

    try {
      const stored = await AsyncStorage.getItem(PASSENGER_HISTORY_KEY);
      const list: PassengerRideHistoryItem[] = stored ? JSON.parse(stored) : [];
      list.unshift(historyItem);
      await AsyncStorage.setItem(PASSENGER_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Erro ao registrar histórico de corrida:', e);
    }

    Alert.alert('Viagem Concluída! 🎉', `Obrigado por viajar na 88 Mobility. Valor: ${formatBRL(totalAmount)}`, [
      {
        text: 'OK',
        onPress: () => {
          setActiveRide(null);
          setStep('idle');
          setDest(null);
          setSearch('');
          setCurrentRideId(null);
        },
      },
    ]);
  };

  const cancelRide = () => {
    Alert.alert('Cancelar chamada?', 'Deseja cancelar o pedido de corrida?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          if (currentRideId) {
            await publishRideEvent({ type: 'CANCEL_RIDE', rideId: currentRideId });
          }

          if (activeRide && destination) {
            const cancelItem: PassengerRideHistoryItem = {
              id: activeRide.id || `ride-${Date.now()}`,
              date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now(),
              origin: 'Sua localização',
              destination: destination.label,
              km: distanceKm,
              total: totalAmount,
              driverName: activeRide.driverName || 'Abel Magalhães',
              status: 'cancelled',
            };
            try {
              const stored = await AsyncStorage.getItem(PASSENGER_HISTORY_KEY);
              const list: PassengerRideHistoryItem[] = stored ? JSON.parse(stored) : [];
              list.unshift(cancelItem);
              await AsyncStorage.setItem(PASSENGER_HISTORY_KEY, JSON.stringify(list));
            } catch (e) {
              console.warn('Erro ao salvar cancelamento:', e);
            }
          }
          setActiveRide(null);
          setStep('idle');
          setDest(null);
          setSearch('');
          setCurrentRideId(null);
        },
      },
    ]);
  };

  const contactDriver = () => {
    const driverName = activeRide?.driverName || 'Motorista';
    const rawPhone = (activeRide?.driverPhone || '11988888888').replace(/\D/g, '');
    Alert.alert(
      `Contato com ${driverName}`,
      'Escolha como deseja se comunicar:',
      [
        { text: 'Ligar', onPress: () => Linking.openURL(`tel:${rawPhone}`) },
        { text: 'WhatsApp', onPress: () => Linking.openURL(`https://wa.me/55${rawPhone}`) },
        { text: 'Fechar', style: 'cancel' },
      ]
    );
  };

  // Marcadores mostrados no OpenStreetMap
  const driverLabel = activeRide?.driverName
    ? `${activeRide.driverName} (${activeRide.driverVehicle} · ${activeRide.driverPlate})`
    : 'Motorista Parceiro Disponível';

  const mapMarkers = [
    {
      latitude: driverPos.latitude,
      longitude: driverPos.longitude,
      title: driverLabel,
      type: 'driver' as const,
    },
    ...(destination ? [{
      latitude: destination.lat,
      longitude: destination.lng,
      title: destination.label,
      type: 'destination' as const,
    }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Mapa 100% nativo OpenStreetMap com motorista Abel e destino em tempo real */}
      <OSMMap
        latitude={coords.lat}
        longitude={coords.lng}
        zoom={destination ? 14 : 15}
        markers={mapMarkers}
      />

      {/* Indicador de carregamento de GPS */}
      {!gpsReady && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator color={Colors.amber} size="large" />
          <Text style={styles.gpsText}>Sincronizando localização GPS...</Text>
        </View>
      )}

      {/* Header com Logo Oficial */}
      <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.headerLogoImage}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerGreeting, { color: colors.text }]}>
            Olá, {passenger?.name?.split(' ')[0] || 'Passageiro'}!
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            🟢 Motorista Abel Magalhães disponível perto
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Corrida ativa com Abel Magalhães */}
      {step === 'active' && activeRide && (
        <View style={[styles.activeSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Card do Motorista Abel */}
          <View style={[styles.driverCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.driverName, { color: colors.text }]}>{activeRide.driverName}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>Oficial 88</Text>
                </View>
              </View>
              <Text style={[styles.driverVehicle, { color: colors.textSecondary }]}>
                {activeRide.driverVehicle} · {activeRide.driverPlate}
              </Text>
              <Text style={[styles.driverRating, { color: colors.amber }]}>
                ⭐ {activeRide.driverRating?.toFixed(1)} (100% de aprovação)
              </Text>
            </View>
            <View style={styles.etaBox}>
              <Text style={styles.etaMin}>{activeRide.estimatedMinutes}</Text>
              <Text style={styles.etaLabel}>minutos</Text>
            </View>
          </View>

          {/* Rota */}
          <View style={[styles.activeRoute, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
            <Text style={[styles.activeRouteText, { color: colors.text }]}>🟢 Sua localização atual</Text>
            <Text style={styles.activeRouteArrow}>↓ ({distanceKm} km estimados)</Text>
            <Text style={[styles.activeRouteText, { color: colors.text }]}>🏁 {destination?.label}</Text>
          </View>

          {/* Total transparente */}
          <View style={styles.activeTotal}>
            <View>
              <Text style={[styles.activeTotalLabel, { color: colors.textSecondary }]}>Valor da Corrida</Text>
              <Text style={styles.feeNotice}>88% vai direto para Abel ({formatBRL(driverShare)})</Text>
            </View>
            <Text style={[styles.activeTotalValue, { color: colors.amber }]}>{formatBRL(totalAmount)}</Text>
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.contactBtn} onPress={contactDriver}>
              <Text style={styles.contactBtnText}>📞 Falar com Abel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishBtn} onPress={completeRide}>
              <Text style={styles.finishBtnText}>Concluir Viagem</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelRide}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Buscando motorista em tempo real */}
      {step === 'searching' && (
        <View style={[styles.searchingSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <ActivityIndicator size="large" color={Colors.amber} style={{ marginBottom: 16 }} />
          <Text style={[styles.searchingTitle, { color: colors.text }]}>Chamando motorista Abel Magalhães...</Text>
          <Text style={[styles.searchingSubtitle, { color: colors.textSecondary }]}>
            Aguardando Abel aceitar a chamada no aplicativo do motorista.
          </Text>
          <TouchableOpacity style={[styles.cancelBtn, { width: '80%', marginTop: 16 }]} onPress={cancelRide}>
            <Text style={styles.cancelBtnText}>Cancelar Chamada</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Painel de busca com Combo de Autocomplete (idle + selecting_destination + confirming) */}
      {(step === 'idle' || step === 'selecting_destination' || step === 'confirming') && (
        <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Combo de endereço com autocompletar em tempo real */}
          <View style={[styles.searchBox, { backgroundColor: colors.slate100, borderColor: colors.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                setStep('selecting_destination');
              }}
              placeholder="Digite o endereço ou local de destino..."
              placeholderTextColor={colors.textMuted}
              onFocus={() => setStep('selecting_destination')}
              autoCapitalize="words"
            />
            {isSearchingAddress && (
              <ActivityIndicator size="small" color={Colors.amber} style={{ marginRight: 6 }} />
            )}
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setDest(null); setStep('idle'); }}>
                <Text style={{ color: colors.slate400, fontSize: 18, paddingHorizontal: 6 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Lista de Sugestões Autocompletadas (Combo Dropdown) */}
          {step === 'selecting_destination' && (
            <View style={styles.suggestionsContainer}>
              <Text style={[styles.suggestionsHeader, { color: colors.textSecondary }]}>
                {search.trim().length >= 3 ? 'Endereços Encontrados:' : 'Destinos Recentes:'}
              </Text>
              {suggestions.length === 0 ? (
                <View style={styles.emptySuggestions}>
                  <Text style={[styles.emptySuggestionsText, { color: colors.textSecondary }]}>
                    Digite o nome da rua, praça ou local para autocompletar.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={suggestions}
                  keyExtractor={i => i.id}
                  style={styles.suggestions}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => selectDestination(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionIcon}>📍</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestionLabel, { color: colors.text }]} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={[styles.suggestionAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                          {item.address}
                        </Text>
                      </View>
                      <Text style={{ color: Colors.amber, fontSize: 16 }}>→</Text>
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
                />
              )}
            </View>
          )}

          {/* Confirmação de corrida com cálculo real por KM */}
          {step === 'confirming' && destination && (
            <View style={styles.confirmPanel}>
              {/* Resumo da rota */}
              <View style={[styles.routeCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
                <View style={styles.routeRow}>
                  <Text style={styles.routeDot}>🟢</Text>
                  <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>
                    Sua localização atual
                  </Text>
                </View>
                <View style={[styles.routeDivLine, { backgroundColor: colors.border }]} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeDot}>🏁</Text>
                  <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>
                    {destination.label} ({destination.address})
                  </Text>
                </View>
              </View>

              {/* Detalhamento de Preço 88 Mobility */}
              <View style={[styles.priceCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                    Distância estimada ({distanceKm} km × {formatBRL(PRICE_PER_KM)}/km)
                  </Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>{formatBRL(kmAmount)}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: Colors.warning }]}>⚡ Horário de Pico</Text>
                  <Text style={[styles.priceValue, { color: Colors.warning }]}>+ {formatBRL(SURGE_FEE)}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>🛡️ Taxa de manutenção da plataforma</Text>
                  <Text style={[styles.priceValue, { color: colors.textMuted }]}>+ {formatBRL(PLATFORM_FEE)}</Text>
                </View>

                <View style={[styles.priceRow, styles.priceTotalRow, { borderTopColor: colors.border }]}>
                  <View>
                    <Text style={[styles.priceTotalLabel, { color: colors.text }]}>Valor Final</Text>
                    <Text style={styles.splitSub}>88% ({formatBRL(driverShare)}) repassado ao motorista Abel</Text>
                  </View>
                  <Text style={[styles.priceTotalValue, { color: colors.amber }]}>{formatBRL(totalAmount)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.requestBtn, { backgroundColor: colors.amber }]}
                onPress={requestRide}
                activeOpacity={0.85}
              >
                <Text style={styles.requestBtnText}>Solicitar com Abel Magalhães</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Atalhos com destinos REAIS recentes */}
          {step === 'idle' && (
            <View style={styles.quickActions}>
              {recentDestinations.length > 0 ? (
                <>
                  <Text style={[styles.quickTitle, { color: colors.textSecondary }]}>Destinos Recentes</Text>
                  <View style={styles.quickRow}>
                    {recentDestinations.slice(0, 4).map((q) => (
                      <TouchableOpacity
                        key={q.id}
                        style={[styles.quickItem, { backgroundColor: colors.slate100, borderColor: colors.border }]}
                        onPress={() => selectDestination(q)}
                      >
                        <Text style={styles.quickIcon}>📍</Text>
                        <Text style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>{q.label}</Text>
                        <Text style={[styles.quickSub, { color: colors.textSecondary }]} numberOfLines={1}>{q.address}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.hintContainer}>
                  <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                    💡 Digite o endereço ou local no campo acima para buscar no mapa em tempo real.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    position: 'absolute',
    top: 50,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1,
  },
  headerLogoImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  headerGreeting: { fontSize: 15, fontWeight: '700' },
  headerSub:      { fontSize: 11, marginTop: 2 },
  logoutBtn:      { paddingVertical: 4, paddingHorizontal: 8 },
  logoutText:     { fontSize: 13, fontWeight: '500' },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 28,
    paddingTop: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
    maxHeight: '75%',
    borderTopWidth: 1,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.md,
  },

  // Combo Search Box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 8,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15 },

  // Sugestões do Combo
  suggestionsContainer: { maxHeight: 260 },
  suggestionsHeader:    { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  suggestions:          { maxHeight: 220 },
  suggestionItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  suggestionIcon:       { fontSize: 18 },
  suggestionLabel:      { fontSize: 14, fontWeight: '600' },
  suggestionAddress:    { fontSize: 12, marginTop: 2 },
  separator:            { height: 1 },
  emptySuggestions:     { paddingVertical: 16, alignItems: 'center' },
  emptySuggestionsText: { fontSize: 13 },

  // Confirmação
  confirmPanel: { gap: Spacing.sm },
  routeCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  routeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot:     { fontSize: 16 },
  routeText:    { flex: 1, fontSize: 14, fontWeight: '500' },
  routeDivLine: { height: 14, width: 1, marginLeft: 12, marginVertical: 2 },

  priceCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 6,
  },
  priceRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel:      { fontSize: 13 },
  priceValue:      { fontSize: 13, fontWeight: '600' },
  priceTotalRow:   { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  priceTotalLabel: { fontSize: 15, fontWeight: '700' },
  splitSub:        { fontSize: 11, color: Colors.success, marginTop: 2, fontWeight: '500' },
  priceTotalValue: { fontSize: 20, fontWeight: '800' },

  requestBtn: {
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: Colors.amber,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginTop: 4,
  },
  requestBtnText: { color: Colors.slate900, fontWeight: '700', fontSize: 16 },

  // Atalhos
  quickActions: { gap: Spacing.xs, marginTop: 4 },
  quickTitle:   { fontSize: 12, fontWeight: '600' },
  quickRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickItem: {
    width: '48%',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
  },
  quickIcon:  { fontSize: 18, marginBottom: 2 },
  quickLabel: { fontSize: 13, fontWeight: '600' },
  quickSub:   { fontSize: 11, marginTop: 1 },
  hintContainer: { paddingVertical: 12, alignItems: 'center' },
  hintText:      { fontSize: 13, textAlign: 'center' },

  // Buscando motorista
  searchingSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: 48,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  searchingTitle:    { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  searchingSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Corrida ativa
  activeSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    paddingBottom: 36,
    gap: Spacing.sm,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText:  { fontSize: 22, fontWeight: '800', color: Colors.slate900 },
  driverName:        { fontSize: 15, fontWeight: '700' },
  verifiedBadge: {
    backgroundColor: Colors.amberLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.amberDark },
  driverVehicle:     { fontSize: 13, marginTop: 2 },
  driverRating:      { fontSize: 12, fontWeight: '600', marginTop: 1 },
  etaBox:            { alignItems: 'center' },
  etaMin:            { fontSize: 26, fontWeight: '800', color: Colors.amber },
  etaLabel:          { fontSize: 11, color: Colors.slate500 },

  activeRoute: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 2,
  },
  activeRouteText:  { fontSize: 13, fontWeight: '500' },
  activeRouteArrow: { fontSize: 11, color: Colors.slate500, paddingLeft: 16 },

  activeTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeTotalLabel: { fontSize: 13 },
  feeNotice:        { fontSize: 11, color: Colors.success, fontWeight: '600', marginTop: 2 },
  activeTotalValue: { fontSize: 22, fontWeight: '800' },

  actionRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },
  contactBtn: {
    flex: 1,
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnText: { color: Colors.slate900, fontWeight: '700', fontSize: 13 },
  finishBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  finishBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },

  gpsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248,250,252,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsText: { color: Colors.slate700, marginTop: 12, fontSize: 14, fontWeight: '500' },
});
