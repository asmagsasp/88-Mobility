import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, FlatList, Alert, ActivityIndicator, Image, Linking,
  Keyboard, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { OSMMap, type CarPosition, type RouteCoordinate } from '../components/OSMMap';
import type { Ride } from '../types';
import type { PassengerRideHistoryItem } from './HistoryScreen';
import {
  publishRideEvent,
  pollRideEvents,
  type SyncRidePayload,
} from '../services/rideSync';
import {
  fetchPassengerRoute,
  calculateBearing,
  calculateDistanceInMeters,
} from '../services/routeService';

type Step = 'idle' | 'selecting_destination' | 'confirming' | 'searching' | 'active';
type ActiveRideStatus = 'arriving' | 'arrived' | 'in_trip';

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
 * - Mapa OpenStreetMap com localização ao vivo e carrinho do 99 em tempo real
 * - Carrinho acompanha o trajeto pelas ruas até chegar ao passageiro
 * - Sincronização em tempo real com o app do motorista
 */
export function HomeScreen() {
  const { passenger, logout } = useAuth();
  const { colors, isDark }    = useTheme();

  const [coords, setCoords]               = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 });
  const [gpsReady, setGpsReady]           = useState(false);
  const [pickupAddress, setPickupAddress] = useState<string>('Sua localização atual');
  const [step, setStep]                   = useState<Step>('idle');
  const [search, setSearch]               = useState('');
  const [isSearchingAddress, setIsSearching] = useState(false);
  const [suggestions, setSuggestions]     = useState<AddressSuggestion[]>([]);
  const [recentDestinations, setRecentDestinations] = useState<AddressSuggestion[]>([]);
  const [destination, setDest]            = useState<AddressSuggestion | null>(null);
  const [activeRide, setActiveRide]       = useState<Partial<Ride> | null>(null);
  const [rideStatus, setRideStatus]       = useState<ActiveRideStatus>('arriving');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Monitora altura do teclado virtual para ajuste fluido
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Rota e Carrinho 99
  const [carPosition, setCarPosition]           = useState<CarPosition | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [onlineDrivers, setOnlineDrivers]       = useState<{
    id: string;
    latitude: number;
    longitude: number;
    vehicle: string;
    plate: string;
    name: string;
    lastSeen: number;
  }[]>([]);

  const lastPollTime = useRef<number>(Math.floor(Date.now() / 1000) - 30);

  // Carrega destinos recentes do passageiro
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

  // Solicita permissão e obtém GPS real do dispositivo com resposta imediata e rastreamento contínuo
  useEffect(() => {
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setGpsReady(true);
          return;
        }

        // Função auxiliar para obter endereço de embarque atual
        const fetchCurrentAddress = async (latitude: number, longitude: number) => {
          try {
            const revRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
              {
                headers: {
                  'User-Agent': '88Mobility-PassengerApp/1.0',
                  'Accept-Language': 'pt-BR,pt;q=0.9',
                },
              }
            );
            if (revRes.ok) {
              const revData = await revRes.json();
              const road = revData.address?.road || revData.address?.pedestrian || revData.address?.suburb;
              const num = revData.address?.house_number;
              if (road) {
                setPickupAddress(num ? `${road}, ${num}` : road);
              }
            }
          } catch {}
        };

        // 1. Obtém imediatamente a última localização conhecida do aparelho (sem atraso de satélite)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (isMounted && lastKnown?.coords) {
          setCoords({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
          setGpsReady(true);
          fetchCurrentAddress(lastKnown.coords.latitude, lastKnown.coords.longitude);
        }

        // 2. Obtém a localização de alta precisão do GPS
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (isMounted && currentLoc?.coords) {
          setCoords({ lat: currentLoc.coords.latitude, lng: currentLoc.coords.longitude });
          setGpsReady(true);
          fetchCurrentAddress(currentLoc.coords.latitude, currentLoc.coords.longitude);
        }

        // 3. Acompanha o deslocamento em tempo real continuamente
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
          (loc) => {
            if (isMounted && loc?.coords) {
              setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
          }
        );
      } catch (err) {
        console.warn('Erro ao obter localização do passageiro:', err);
        if (isMounted) setGpsReady(true);
      }
    })();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Busca e autocompleta endereços em tempo real com suporte a numeração de residência
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setSuggestions(recentDestinations);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        // Extrai número predial/residencial (ex: "Rua Augusta 1500", "Av Paulista, 1000", "Rua das Flores nº 45B", "Rua 15 de Novembro, 120")
        const endNumMatch = trimmed.match(/(?:,\s*|\s+n[º°]?\s*|\s+)(\d{1,6}[a-zA-Z]?)$/i);
        const commaNumMatch = trimmed.match(/,\s*(\d{1,6}[a-zA-Z]?)/i);
        const typedNumber = endNumMatch ? endNumMatch[1] : (commaNumMatch ? commaNumMatch[1] : null);

        let queryWithoutNumber = trimmed;
        if (typedNumber) {
          queryWithoutNumber = trimmed
            .replace(new RegExp(`(?:,\\s*|\\s+n[º°]?\\s*|\\s+)${typedNumber}$`, 'i'), '')
            .replace(new RegExp(`,\\s*${typedNumber}`, 'i'), '')
            .trim();
        }

        // Viewbox suave para priorizar a região do passageiro sem restringir outros bairros/cidades
        const viewboxLocal = coords ? `&viewbox=${coords.lng - 0.6},${coords.lat + 0.6},${coords.lng + 0.6},${coords.lat - 0.6}` : '';
        let data: any[] = [];

        // 1. Tenta buscar endereço com o texto original priorizando a proximidade do passageiro
        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=8&countrycodes=br${viewboxLocal}`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': '88Mobility-PassengerApp/1.0',
              'Accept-Language': 'pt-BR,pt;q=0.9',
            },
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch {}

        // 2. Se a busca com número não retornou resultados locais, busca pelo nome da via
        if ((!Array.isArray(data) || data.length === 0) && typedNumber && queryWithoutNumber.length >= 3) {
          try {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithoutNumber)}&format=json&addressdetails=1&limit=8&countrycodes=br${viewboxLocal}`;
            const fbRes = await fetch(fallbackUrl, {
              headers: {
                'User-Agent': '88Mobility-PassengerApp/1.0',
                'Accept-Language': 'pt-BR,pt;q=0.9',
              },
            });
            if (fbRes.ok) {
              data = await fbRes.json();
            }
          } catch {}
        }

        // 3. Fallback inteligente via Photon API (Komoot / OSM elástico com tolerância a erros e alta velocidade)
        if (!Array.isArray(data) || data.length === 0) {
          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=8&lat=${coords.lat}&lon=${coords.lng}`;
            const pRes = await fetch(photonUrl);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.features && pData.features.length > 0) {
                data = pData.features.map((f: any, idx: number) => {
                  const p = f.properties;
                  const name = p.name || p.street || trimmed;
                  const num = p.housenumber || typedNumber;
                  const road = num ? `${name}, ${num}` : name;
                  return {
                    place_id: `photon-${idx}-${Date.now()}`,
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0],
                    display_name: [road, p.district, p.city, p.state].filter(Boolean).join(', '),
                    address: {
                      road: name,
                      house_number: num,
                      suburb: p.district || p.suburb,
                      city: p.city,
                      state: p.state,
                    },
                  };
                });
              }
            }
          } catch {}
        }

        if (Array.isArray(data) && data.length > 0) {
          // Ordena as ruas encontradas por proximidade do GPS atual do usuário (a rua local mais próxima fica em 1º)
          data.sort((a: any, b: any) => {
            const distA = calculateDistanceInMeters(coords.lat, coords.lng, parseFloat(a.lat), parseFloat(a.lon));
            const distB = calculateDistanceInMeters(coords.lat, coords.lng, parseFloat(b.lat), parseFloat(b.lon));
            return distA - distB;
          });

          const parsed: AddressSuggestion[] = data.map((item: any) => {
            const rawRoad = item.address?.road || item.address?.pedestrian || item.address?.suburb || item.display_name.split(',')[0].trim();
            // Pega o número retornado pela API ou preserva com exatidão o número digitado pelo passageiro
            const houseNum = item.address?.house_number || typedNumber;

            // Garante que o número apareça no label do alfinete
            let formattedLabel = rawRoad;
            if (houseNum && !rawRoad.toLowerCase().includes(houseNum.toLowerCase())) {
              formattedLabel = `${rawRoad}, ${houseNum}`;
            }

            const suburb = item.address?.suburb || item.address?.neighbourhood || '';
            const city = item.address?.city || item.address?.town || item.address?.municipality || '';
            const state = item.address?.state || '';
            const sub = [suburb, city, state].filter(Boolean).join(', ') || item.display_name;

            return {
              id: String(item.place_id),
              label: formattedLabel,
              address: sub,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          setSuggestions(parsed);
        } else {
          // Se não encontrou, oferece busca direta
          setSuggestions([
            {
              id: `custom-${Date.now()}`,
              label: trimmed,
              address: 'Local aproximado informado pelo passageiro',
              lat: coords.lat,
              lng: coords.lng,
            },
          ]);
        }
      } catch (error) {
        console.warn('Erro no autocomplete de endereço:', error);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [search, coords, recentDestinations]);

  // Distância calculada e precificação exata do 88 Mobility
  const distanceKm = destination
    ? getHaversineDistanceKm(coords.lat, coords.lng, destination.lat, destination.lng)
    : 0;
  const kmAmount    = distanceKm * PRICE_PER_KM;
  const totalAmount = kmAmount + SURGE_FEE + PLATFORM_FEE;
  const driverShare = totalAmount * 0.88;

  // Carrega o trajeto do motorista até o passageiro (desenha a rota no mapa sem timer falso)
  const loadDriverRouteToPassenger = async (startLat: number, startLng: number, driverName: string = 'Motorista', vehicleName: string = 'Honda Fit') => {
    try {
      const route = await fetchPassengerRoute(startLat, startLng, coords.lat, coords.lng);
      setRouteCoordinates(route.coordinates);

      const carLabel = `${driverName.split(' ')[0]} · ${vehicleName}`;

      if (route.coordinates.length > 0) {
        setCarPosition({
          latitude: route.coordinates[0].latitude,
          longitude: route.coordinates[0].longitude,
          heading: 0,
          label: carLabel,
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar trajeto do motorista no passageiro:', e);
    }
  };

  // Carrega trajeto até o destino final quando a viagem inicia (sem simulação falsa)
  const loadTripRouteToDestination = async (startLat: number, startLng: number, destLat: number, destLng: number) => {
    try {
      const route = await fetchPassengerRoute(startLat, startLng, destLat, destLng);
      setRouteCoordinates(route.coordinates);
    } catch (e) {
      console.warn('Erro ao carregar rota até destino:', e);
    }
  };

  // Sincronização em tempo real de motoristas online e ciclo de corrida
  useEffect(() => {
    let isPolling = true;

    const interval = setInterval(async () => {
      if (!isPolling) return;
      try {
        const { events, latestTime } = await pollRideEvents(lastPollTime.current);
        lastPollTime.current = latestTime;

        // Remove motoristas inativos cujo sinal expirou há mais de 30 segundos
        const now = Date.now();
        setOnlineDrivers((prev) => prev.filter((d) => (now - d.lastSeen) <= 30000));

        for (const ev of events) {
          // 1. Atualização do status online/offline do motorista
          if (ev.type === 'DRIVER_STATUS') {
            if (ev.isOnline) {
              setOnlineDrivers((prev) => {
                const filtered = prev.filter((d) => d.id !== ev.driverId);
                return [
                  ...filtered,
                  {
                    id: ev.driverId,
                    latitude: ev.latitude || coords.lat,
                    longitude: ev.longitude || coords.lng,
                    vehicle: ev.vehicle || 'Honda Fit',
                    plate: ev.plate || 'BRA2E19',
                    name: ev.name || 'Motorista Parceiro',
                    lastSeen: Date.now(),
                  },
                ];
              });
            } else {
              setOnlineDrivers((prev) => prev.filter((d) => d.id !== ev.driverId));
              if (!activeRide) {
                setCarPosition(null);
              }
            }
          }

          // 2. Eventos da corrida em andamento
          else if (ev.type === 'ACCEPT_RIDE' && currentRideId && ev.rideId === currentRideId) {
            // Motorista aceitou a chamada!
            const dName = ev.driver?.name || 'Motorista Parceiro';
            const vName = ev.driver?.vehicle || 'Honda Fit';
            setActiveRide({
              id: currentRideId,
              driverName: dName,
              driverVehicle: vName,
              driverPlate: ev.driver?.plate || 'BRA-8888',
              driverRating: ev.driver?.rating || 5.0,
              driverPhone: ev.driver?.phone || '',
              estimatedMinutes: 3,
              totalAmount,
              driverShare,
              platformShare: PLATFORM_FEE,
              status: 'arriving',
            });
            setRideStatus('arriving');
            setStep('active');

            // Inicia o acompanhamento da rota pelas ruas até o passageiro com a posição real do motorista
            const startDriverLat = ev.driver?.latitude || coords.lat;
            const startDriverLng = ev.driver?.longitude || coords.lng;
            loadDriverRouteToPassenger(startDriverLat, startDriverLng, dName, vName);

          } else if (ev.type === 'DRIVER_LOCATION' && currentRideId && ev.rideId === currentRideId) {
            // Posição em tempo real recebida do GPS FÍSICO real do motorista
            const currentDriverName = activeRide?.driverName || ev.driverName || 'Motorista';
            const vehicleName = activeRide?.driverVehicle || ev.vehicle || 'Honda Fit';
            setCarPosition({
              latitude: ev.latitude,
              longitude: ev.longitude,
              heading: ev.heading || 0,
              label: `${currentDriverName.split(' ')[0]} · ${vehicleName}`,
            });

          } else if (ev.type === 'ARRIVED_PASSENGER' && currentRideId && ev.rideId === currentRideId) {
            // Motorista chegou ao ponto de embarque
            setRideStatus('arrived');

          } else if (ev.type === 'START_TRIP' && currentRideId && ev.rideId === currentRideId) {
            // Motorista iniciou a viagem até o destino
            setRideStatus('in_trip');
            if (destination) {
              loadTripRouteToDestination(coords.lat, coords.lng, destination.lat, destination.lng);
            }

          } else if (ev.type === 'DECLINE_RIDE' && currentRideId && ev.rideId === currentRideId) {
            setStep('confirming');
            Alert.alert(
              'Motorista Ocupado',
              'O motorista não pôde aceitar esta chamada no momento. Você pode tentar novamente.'
            );

          } else if (ev.type === 'COMPLETE_RIDE' && currentRideId && ev.rideId === currentRideId) {
            // Motorista finalizou a corrida
            if (destination) {
              const historyItem: PassengerRideHistoryItem = {
                id: currentRideId,
                date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now(),
                origin: pickupAddress || 'Local de Embarque',
                destination: destination.label,
                km: distanceKm,
                total: totalAmount,
                driverName: activeRide?.driverName || 'Motorista Parceiro',
                status: 'completed',
              };
              const stored = await AsyncStorage.getItem(PASSENGER_HISTORY_KEY);
              const list: PassengerRideHistoryItem[] = stored ? JSON.parse(stored) : [];
              list.unshift(historyItem);
              await AsyncStorage.setItem(PASSENGER_HISTORY_KEY, JSON.stringify(list));
            }
            Alert.alert('Viagem Concluída! 🎉', `Corrida finalizada com sucesso. Total: ${formatBRL(totalAmount)}`);
            setActiveRide(null);
            setRouteCoordinates([]);
            setCarPosition(null);
            setStep('idle');
            setDest(null);
            setSearch('');
            setCurrentRideId(null);
          }
        }
      } catch (err) {
        console.warn('Erro ao escutar eventos de corrida/motorista:', err);
      }
    }, (step === 'searching' || step === 'active') ? 1500 : 3500);

    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [step, currentRideId, destination, distanceKm, totalAmount, driverShare, activeRide, pickupAddress]);

  const selectDestination = async (item: AddressSuggestion) => {
    Keyboard.dismiss();
    setDest(item);
    setSearch(item.label);
    setStep('confirming');

    try {
      const filtered = recentDestinations.filter(d => d.id !== item.id);
      const updated = [item, ...filtered].slice(0, 5);
      setRecentDestinations(updated);
      await AsyncStorage.setItem(RECENT_DESTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar destino recente:', e);
    }
  };

  // Solicitar corrida
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
        address: pickupAddress || 'Local de Embarque',
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
      estimatedMinutes: Math.round(distanceKm * 2.5),
    };

    const success = await publishRideEvent({
      type: 'REQUEST_RIDE',
      ride: ridePayload,
    });

    if (!success) {
      Alert.alert(
        'Atenção na Conexão',
        'Não foi possível conectar com o aplicativo do motorista. Verifique sua conexão à internet.'
      );
    }
  };

  // Cancelar chamada
  const cancelRide = async () => {
    if (currentRideId) {
      await publishRideEvent({
        type: 'CANCEL_RIDE',
        rideId: currentRideId,
      });
    }
    setRouteCoordinates([]);
    setCarPosition(null);
    setCurrentRideId(null);
    setActiveRide(null);
    setStep('idle');
  };

  // Concluir viagem pelo passageiro
  const completeRide = async () => {
    Alert.alert('Finalizar Viagem', 'Deseja confirmar o desembarque e concluir a corrida?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, Concluir',
        onPress: async () => {
          if (destination) {
            const historyItem: PassengerRideHistoryItem = {
              id: currentRideId || `ride-${Date.now()}`,
              date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now(),
              origin: pickupAddress || 'Local de Embarque',
              destination: destination.label,
              km: distanceKm,
              total: totalAmount,
              driverName: activeRide?.driverName || 'Motorista Parceiro',
              status: 'completed',
            };
            const stored = await AsyncStorage.getItem(PASSENGER_HISTORY_KEY);
            const list: PassengerRideHistoryItem[] = stored ? JSON.parse(stored) : [];
            list.unshift(historyItem);
            await AsyncStorage.setItem(PASSENGER_HISTORY_KEY, JSON.stringify(list));
          }
          if (currentRideId) {
            await publishRideEvent({ type: 'COMPLETE_RIDE', rideId: currentRideId });
          }
          setRouteCoordinates([]);
          setCarPosition(null);
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

  // Marcadores do mapa
  const mapMarkers = [
    ...(destination ? [{
      latitude: destination.lat,
      longitude: destination.lng,
      title: destination.label,
      type: 'destination' as const,
    }] : []),
  ];

  // Exibe o carrinho no mapa APENAS se houver posição GPS real recebida ou se houver motorista online
  const activeCar = carPosition || (activeRide && onlineDrivers.length > 0 ? {
    latitude: onlineDrivers[0].latitude,
    longitude: onlineDrivers[0].longitude,
    heading: 45,
    label: `${activeRide.driverName || 'Motorista'} · ${activeRide.driverVehicle || 'Honda Fit'}`,
  } : (onlineDrivers.length > 0 ? {
    latitude: onlineDrivers[0].latitude,
    longitude: onlineDrivers[0].longitude,
    heading: 45,
    label: `${onlineDrivers[0].name} · ${onlineDrivers[0].vehicle}`,
  } : null));

  return (
    <View style={styles.container}>
      {/* Mapa 100% nativo OpenStreetMap com carrinho do 99 e círculo animado de busca de 10 km */}
      <OSMMap
        latitude={coords.lat}
        longitude={coords.lng}
        zoom={destination ? 14 : 15}
        markers={mapMarkers}
        carPosition={activeCar}
        routeCoordinates={routeCoordinates}
        isSearching={step === 'searching'}
        searchRadiusKm={10}
        nearbyDrivers={onlineDrivers.map((d) => ({
          latitude: d.latitude,
          longitude: d.longitude,
          title: `${d.name} (${d.vehicle})`,
        }))}
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
            {step === 'active'
              ? (rideStatus === 'arrived' ? `🟢 ${activeRide?.driverVehicle || 'Honda Fit'} no local de embarque!` : `🟡 ${activeRide?.driverVehicle || 'Honda Fit'} a caminho`)
              : (onlineDrivers.length > 0
                  ? `🟢 Motorista ${onlineDrivers[0].name} (${onlineDrivers[0].vehicle}) online por perto`
                  : `🔴 Nenhum motorista ativo no momento`)}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Corrida ativa com motorista */}
      {step === 'active' && activeRide && (
        <View style={[styles.activeSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Banner de Status Dinâmico */}
          <View style={[
            styles.statusBanner,
            rideStatus === 'arrived' ? styles.statusBannerArrived : styles.statusBannerArriving,
          ]}>
            <Text style={styles.statusBannerText}>
              {rideStatus === 'arriving' && `🚗 Acompanhando ${activeRide.driverVehicle || 'veículo'} no mapa até seu local`}
              {rideStatus === 'arrived' && `📍 Motorista chegou! Embarque no ${activeRide.driverVehicle || 'veículo'} (${activeRide.driverPlate || 'BRA-8888'})`}
              {rideStatus === 'in_trip' && `🚀 Viagem em andamento para seu destino no ${activeRide.driverVehicle || 'veículo'}`}
            </Text>
          </View>

          {/* Card do Motorista Parceiro */}
          <View style={[styles.driverCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{activeRide.driverName?.charAt(0) || 'M'}</Text>
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
              <Text style={styles.etaMin}>
                {rideStatus === 'arrived' ? 'AQUI' : activeRide.estimatedMinutes}
              </Text>
              <Text style={styles.etaLabel}>
                {rideStatus === 'arrived' ? 'embarque' : 'minutos'}
              </Text>
            </View>
          </View>

          {/* Rota */}
          <View style={[styles.activeRoute, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
            <Text style={[styles.activeRouteText, { color: colors.text }]}>🟢 {pickupAddress || 'Local de Embarque'}</Text>
            <Text style={styles.activeRouteArrow}>↓ ({distanceKm} km estimados)</Text>
            <Text style={[styles.activeRouteText, { color: colors.text }]}>🏁 {destination?.label}</Text>
          </View>

          {/* Total transparente */}
          <View style={styles.activeTotal}>
            <View>
              <Text style={[styles.activeTotalLabel, { color: colors.textSecondary }]}>Valor da Corrida</Text>
              <Text style={styles.feeNotice}>88% repasse líquido ao motorista ({formatBRL(driverShare)})</Text>
            </View>
            <Text style={[styles.activeTotalValue, { color: colors.amber }]}>{formatBRL(totalAmount)}</Text>
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.contactBtn} onPress={contactDriver}>
              <Text style={styles.contactBtnText}>📞 Falar com {activeRide.driverName?.split(' ')[0] || 'Motorista'}</Text>
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

      {/* Buscando motorista em tempo real com Radar estilo 99 */}
      {step === 'searching' && (
        <View style={[styles.searchingSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <View style={styles.searchingRadarBadge}>
            <Text style={styles.searchingRadarIcon}>📡</Text>
            <Text style={styles.searchingRadarBadgeText}>RAIO DE BUSCA: ATÉ 10 KM</Text>
          </View>

          <ActivityIndicator size="large" color={Colors.amber} style={{ marginVertical: 14 }} />
          <Text style={[styles.searchingTitle, { color: colors.text }]}>Buscando motoristas parceiros...</Text>
          <Text style={[styles.searchingSub, { color: colors.textSecondary }]}>
            Escaneando motoristas ativos em um raio de até 10 km ao seu redor em tempo real.
          </Text>

          <TouchableOpacity style={styles.cancelSearchBtn} onPress={cancelRide}>
            <Text style={styles.cancelSearchText}>Cancelar Pedido</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmar corrida */}
      {step === 'confirming' && destination && (
        <View style={[styles.confirmSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Confirmar Corrida 88</Text>

          <View style={[styles.routeCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
            <View style={styles.routeRow}>
              <Text style={styles.routeDot}>🟢</Text>
              <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>
                {pickupAddress || 'Sua localização atual'}
              </Text>
            </View>
            <View style={[styles.routeDivLine, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <Text style={styles.routeDot}>🏁</Text>
              <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>
                {destination.label}
              </Text>
            </View>
          </View>

          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Distância aproximada</Text>
              <Text style={[styles.priceVal, { color: colors.text }]}>{distanceKm} km</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Repasse ao Motorista (88%)</Text>
              <Text style={[styles.priceVal, { color: Colors.success, fontWeight: '700' }]}>
                {formatBRL(driverShare)}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Taxa da Plataforma (12%)</Text>
              <Text style={[styles.priceVal, { color: colors.text }]}>{formatBRL(PLATFORM_FEE)}</Text>
            </View>
            <View style={[styles.priceDivider, { backgroundColor: colors.border }]} />
            <View style={styles.priceRowTotal}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total Final</Text>
              <Text style={[styles.totalVal, { color: colors.amber }]}>{formatBRL(totalAmount)}</Text>
            </View>
          </View>

          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: colors.border }]}
              onPress={() => setStep('idle')}
            >
              <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.requestBtn} onPress={requestRide}>
              <Text style={styles.requestBtnText}>Chamar Corrida Agora 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 1. Modal / Tela de Busca de Destino no Topo (O teclado NUNCA sobrepõe) */}
      {step === 'selecting_destination' && (
        <View
          style={[
            styles.destinationSearchOverlay,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(Spacing.md, keyboardHeight),
            },
          ]}
        >
          {/* Header com botão voltar e título */}
          <View style={styles.searchOverlayHeader}>
            <TouchableOpacity
              style={[styles.searchBackBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Keyboard.dismiss();
                setSearch('');
                setStep('idle');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.searchBackText, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.searchOverlayTitle, { color: colors.text }]}>Para onde vamos?</Text>
              <Text style={[styles.searchOverlaySub, { color: colors.textSecondary }]}>
                Digite o endereço com o número da residência
              </Text>
            </View>
          </View>

          {/* Campo de Busca no TOPO */}
          <View style={[styles.searchInputWrapperActive, { backgroundColor: colors.card, borderColor: colors.amber }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Ex: Rua Augusta, 1500 ou Av Paulista..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              autoFocus={true}
              returnKeyType="search"
              onChangeText={(text) => setSearch(text)}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearSearchBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}
            {isSearchingAddress && <ActivityIndicator size="small" color={Colors.amber} />}
          </View>

          {/* Lista de Sugestões com alfinetes vermelhos */}
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            style={styles.suggestionsListFull}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                onPress={() => selectDestination(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.sugPinBg, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={styles.sugPin}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sugLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.sugAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !isSearchingAddress && search.trim().length >= 3 ? (
                <View style={styles.emptySugContainer}>
                  <Text style={[styles.emptySugText, { color: colors.textSecondary }]}>
                    Nenhum endereço exato encontrado no mapa para "{search}".
                  </Text>
                  <TouchableOpacity
                    style={[styles.customAddrBtn, { backgroundColor: Colors.amber }]}
                    onPress={() => {
                      selectDestination({
                        id: `custom-${Date.now()}`,
                        label: search.trim(),
                        address: 'Endereço digitado pelo passageiro',
                        lat: coords.lat + 0.015,
                        lng: coords.lng + 0.015,
                      });
                    }}
                  >
                    <Text style={styles.customAddrBtnText}>📍 Usar "{search.trim()}" como destino</Text>
                  </TouchableOpacity>
                </View>
              ) : undefined
            }
          />
        </View>
      )}

      {/* 2. Caixa de busca quando em repouso (Bottom Sheet) */}
      {step === 'idle' && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setStep('selecting_destination')}
          style={[styles.searchBoxSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.searchTitle, { color: colors.text }]}>Para onde vamos?</Text>

          <View style={[styles.searchInputWrapper, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={[styles.searchInputPlaceholder, { color: colors.textSecondary }]}>
              {search.trim() ? search : 'Digite o endereço ou local...'}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 10,
  },
  headerLogoImage: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  headerGreeting: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  statusBannerArriving: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statusBannerArrived: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  activeSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    borderTopWidth: 1,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    zIndex: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.slate900,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
  },
  verifiedBadge: {
    backgroundColor: Colors.amberLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.amberDark,
  },
  driverVehicle: {
    fontSize: 13,
    marginTop: 2,
  },
  driverRating: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  etaBox: {
    alignItems: 'center',
  },
  etaMin: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.amber,
  },
  etaLabel: {
    fontSize: 11,
    color: Colors.slate500,
  },
  activeRoute: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 2,
    marginTop: 10,
  },
  activeRouteText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activeRouteArrow: {
    fontSize: 11,
    color: Colors.slate500,
    paddingLeft: 16,
  },
  activeTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeTotalLabel: {
    fontSize: 13,
  },
  feeNotice: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  activeTotalValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  contactBtn: {
    flex: 1,
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnText: {
    color: Colors.slate900,
    fontWeight: '700',
    fontSize: 13,
  },
  finishBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  finishBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelBtnText: {
    color: Colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  searchingSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    borderTopWidth: 1,
    alignItems: 'center',
    elevation: 16,
    zIndex: 20,
  },
  searchingRadarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 6,
  },
  searchingRadarIcon: {
    fontSize: 14,
  },
  searchingRadarBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  searchingSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  cancelSearchBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.md,
    backgroundColor: '#334155',
  },
  cancelSearchText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13,
  },
  confirmSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    borderTopWidth: 1,
    elevation: 16,
    zIndex: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  routeCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    fontSize: 16,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  routeDivLine: {
    height: 14,
    width: 1,
    marginLeft: 12,
    marginVertical: 2,
  },
  priceBreakdown: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 13,
  },
  priceVal: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceDivider: {
    height: 1,
    marginVertical: 8,
  },
  priceRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  backBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  requestBtn: {
    flex: 2,
    backgroundColor: Colors.amber,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  requestBtnText: {
    color: Colors.slate900,
    fontWeight: '800',
    fontSize: 15,
  },
  searchBoxSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    borderTopWidth: 1,
    elevation: 16,
    zIndex: 20,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  suggestionsList: {
    marginTop: 10,
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  sugPin: {
    fontSize: 16,
  },
  sugLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  sugAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  destinationSearchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Platform.OS === 'android' ? 44 : 54,
    paddingHorizontal: Spacing.md,
    zIndex: 100,
  },
  searchOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.md,
  },
  searchBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBackText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  searchOverlayTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  searchOverlaySub: {
    fontSize: 12,
    marginTop: 2,
  },
  searchInputWrapperActive: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  searchInputPlaceholder: {
    fontSize: 15,
    flex: 1,
  },
  clearSearchBtn: {
    padding: 6,
  },
  suggestionsListFull: {
    flex: 1,
  },
  sugPinBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySugContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  emptySugText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  customAddrBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  customAddrBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  gpsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248,250,252,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  gpsText: {
    color: Colors.slate700,
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
});
