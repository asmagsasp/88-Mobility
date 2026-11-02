import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, Dimensions, Switch, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { OSMMap, type CarPosition, type RouteCoordinate } from '../components/OSMMap';
import { NavigationBanner } from '../components/NavigationBanner';
import type { CompletedDriverRide } from './EarningsScreen';
import {
  publishRideEvent,
  pollRideEvents,
  type SyncRidePayload,
} from '../services/rideSync';
import {
  fetchDrivingRoute,
  calculateBearing,
  type RouteStep,
} from '../services/routeService';
import { ttsService } from '../services/ttsService';

const { height } = Dimensions.get('window');
const COMPLETED_RIDES_KEY = '@88mobility_driver_completed_rides';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type RidePhase = 'idle' | 'to_passenger' | 'at_passenger' | 'to_destination';

export function HomeScreen() {
  const { driver, logout } = useAuth();
  const [coords, setCoords]           = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 });
  const [gpsReady, setGpsReady]       = useState(false);
  const [isOnline, setIsOnline]       = useState(false);
  const [rideRequest, setRideRequest] = useState<SyncRidePayload | null>(null);
  const [activeRide, setActiveRide]   = useState<SyncRidePayload | null>(null);
  const [ridePhase, setRidePhase]     = useState<RidePhase>('idle');
  const [completedToday, setCompletedToday] = useState<{ total: number; count: number }>({ total: 0, count: 0 });

  // Rota, Navegação GPS e Carrinho 99
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [routeSteps, setRouteSteps]             = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [carPosition, setCarPosition]           = useState<CarPosition | null>(null);
  const [voiceEnabled, setVoiceEnabled]         = useState<boolean>(true);

  // Intervalos de navegação e polling
  const navIntervalRef = useRef<any>(null);
  const lastPollTime   = useRef<number>(Math.floor(Date.now() / 1000) - 60);
  const rejectedRideIds = useRef<Set<string>>(new Set());
  const slideAnim      = useRef(new Animated.Value(300)).current;

  // Carrega ganhos reais do dia a partir do storage
  const loadTodayStats = async () => {
    try {
      const stored = await AsyncStorage.getItem(COMPLETED_RIDES_KEY);
      if (stored) {
        const rides: CompletedDriverRide[] = JSON.parse(stored);
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const todayRides = rides.filter(r => (now - r.timestamp) <= oneDayMs);
        const total = todayRides.reduce((acc, r) => acc + r.earning, 0);
        setCompletedToday({ total, count: todayRides.length });
      } else {
        setCompletedToday({ total: 0, count: 0 });
      }
    } catch (e) {
      console.warn('Erro ao carregar estatísticas do dia:', e);
    }
  };

  useEffect(() => {
    loadTodayStats();
  }, [activeRide]);

  // Solicita permissão e obtém localização real GPS
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
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setCoords({ lat, lng });
          setCarPosition({ latitude: lat, longitude: lng, heading: 0 });
          setGpsReady(true);
        }
      } catch (err) {
        console.warn('Erro ao obter localização do motorista:', err);
        if (isMounted) setGpsReady(true);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Polling em tempo real para receber chamadas de passageiros quando estiver Online
  useEffect(() => {
    if (!isOnline) return;

    let isPolling = true;

    const interval = setInterval(async () => {
      if (!isOnline || !isPolling) return;
      try {
        const { events, latestTime } = await pollRideEvents(lastPollTime.current);
        lastPollTime.current = latestTime;

        for (const ev of events) {
          if (ev.type === 'REQUEST_RIDE') {
            const requested = ev.ride;
            if (rejectedRideIds.current.has(requested.id)) continue;
            if (activeRide && activeRide.id === requested.id) continue;
            if (rideRequest && rideRequest.id === requested.id) continue;

            // Nova chamada recebida do passageiro!
            setRideRequest(requested);
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65 }).start();
          } else if (ev.type === 'CANCEL_RIDE') {
            if (rideRequest && rideRequest.id === ev.rideId) {
              dismissRequest();
              Alert.alert('Chamada Cancelada', 'O passageiro cancelou o pedido de corrida.');
            } else if (activeRide && activeRide.id === ev.rideId) {
              stopNavigation();
              setActiveRide(null);
              setRidePhase('idle');
              Alert.alert('Corrida Cancelada', 'O passageiro cancelou a corrida em andamento.');
            }
          }
        }
      } catch (pollErr) {
        console.warn('Erro no polling do motorista:', pollErr);
      }
    }, 1800);

    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [isOnline, rideRequest, activeRide]);

  // Limpa navegação ativa
  const stopNavigation = () => {
    if (navIntervalRef.current) {
      clearInterval(navIntervalRef.current);
      navIntervalRef.current = null;
    }
    ttsService.stop();
    setRouteCoordinates([]);
    setRouteSteps([]);
    setCurrentStepIndex(0);
  };

  // Recusar corrida
  const dismissRequest = (rideId?: string) => {
    const targetId = rideId || rideRequest?.id;
    if (targetId) {
      rejectedRideIds.current.add(targetId);
      publishRideEvent({ type: 'DECLINE_RIDE', rideId: targetId });
    }
    Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }).start(() => {
      setRideRequest(null);
      slideAnim.setValue(300);
    });
  };

  /**
   * Inicia o acompanhamento da rota com o carrinho estilo 99 e a narração por voz TTS
   */
  const startNavigationTrack = async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    phase: 'to_passenger' | 'to_destination',
    targetLabel: string,
    rideId: string
  ) => {
    stopNavigation();
    setRidePhase(phase);

    try {
      // 1. Busca rota real pelas ruas via OSRM
      const route = await fetchDrivingRoute(startLat, startLng, endLat, endLng, targetLabel);
      setRouteCoordinates(route.coordinates);
      setRouteSteps(route.steps);
      setCurrentStepIndex(0);

      // 2. Primeira instrução por voz TTS
      if (route.steps.length > 0) {
        const first = route.steps[0];
        const intro = phase === 'to_passenger'
          ? `Corrida aceita. A caminho do passageiro. ${first.instruction}`
          : `Viagem iniciada. ${first.instruction}`;
        ttsService.speak(intro);
      }

      // 3. Animação suave do carrinho ao longo do trajeto
      const coordsList = route.coordinates;
      let currentIndex = 0;
      let stepIdx = 0;

      navIntervalRef.current = setInterval(async () => {
        if (currentIndex >= coordsList.length - 1) {
          // Chegou ao fim deste trecho!
          stopNavigation();

          if (phase === 'to_passenger') {
            setRidePhase('at_passenger');
            ttsService.speak('Você chegou ao local de embarque do passageiro. Aguarde o embarque.');
            await publishRideEvent({ type: 'ARRIVED_PASSENGER', rideId });
          } else {
            ttsService.speak('Você chegou ao destino final.');
          }
          return;
        }

        currentIndex++;
        const currentPt = coordsList[currentIndex];
        const nextPt = coordsList[Math.min(currentIndex + 1, coordsList.length - 1)];
        const heading = calculateBearing(currentPt.latitude, currentPt.longitude, nextPt.latitude, nextPt.longitude);

        const driverVehicleName = driver?.vehicle || 'Honda Fit';
        const driverFirstName = driver?.name?.split(' ')[0] || 'Abel';

        setCarPosition({
          latitude: currentPt.latitude,
          longitude: currentPt.longitude,
          heading,
          label: `${driverFirstName} · ${driverVehicleName}`,
        });

        // Envia posição em tempo real para o app do passageiro
        publishRideEvent({
          type: 'DRIVER_LOCATION',
          rideId,
          latitude: currentPt.latitude,
          longitude: currentPt.longitude,
          heading,
        });

        // Verifica se alcançou o próximo passo de manobra / rua
        if (stepIdx < route.steps.length - 1) {
          const nextStep = route.steps[stepIdx + 1];
          const distToNextStep = Math.hypot(
            currentPt.latitude - nextStep.location.latitude,
            currentPt.longitude - nextStep.location.longitude
          );

          // Quando se aproxima da próxima esquina/rua
          if (distToNextStep < 0.0007) {
            stepIdx++;
            setCurrentStepIndex(stepIdx);
            ttsService.speak(nextStep.instruction);
          }
        }
      }, 1400);

    } catch (err) {
      console.warn('Erro ao iniciar navegação de rota:', err);
    }
  };

  // Aceitar corrida
  const acceptRide = async () => {
    if (!rideRequest) return;
    const current = rideRequest;

    await publishRideEvent({
      type: 'ACCEPT_RIDE',
      rideId: current.id,
      driver: {
        name: driver?.name || 'Abel Magalhães',
        vehicle: driver?.vehicle || 'Honda Fit',
        plate: driver?.vehiclePlate || 'BRA-8888',
        phone: driver?.phone || '(11) 98888-8888',
        rating: driver?.rating || 5.0,
      },
    });

    setActiveRide(current);
    Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setRideRequest(null);
      slideAnim.setValue(300);
    });

    // Inicia trajeto até o ponto de embarque do passageiro
    startNavigationTrack(
      coords.lat,
      coords.lng,
      current.origin.latitude,
      current.origin.longitude,
      'to_passenger',
      current.origin.address || 'Local de Embarque',
      current.id
    );
  };

  // Motorista chegou ao passageiro (caso queira confirmar manualmente com um clique)
  const confirmArrivedAtPassenger = async () => {
    if (!activeRide) return;
    stopNavigation();
    setRidePhase('at_passenger');
    ttsService.speak('Você chegou ao local de embarque do passageiro. Aguarde o passageiro.');
    await publishRideEvent({ type: 'ARRIVED_PASSENGER', rideId: activeRide.id });
  };

  // Iniciar viagem com o passageiro em direção ao destino final
  const startTripWithPassenger = async () => {
    if (!activeRide) return;
    await publishRideEvent({ type: 'START_TRIP', rideId: activeRide.id });

    startNavigationTrack(
      activeRide.origin.latitude,
      activeRide.origin.longitude,
      activeRide.destination.latitude,
      activeRide.destination.longitude,
      'to_destination',
      activeRide.destination.address || 'Destino',
      activeRide.id
    );
  };

  // Concluir corrida
  const completeRide = async () => {
    if (!activeRide) return;
    stopNavigation();

    const current = activeRide;
    const earning = current.driverShare;

    ttsService.speak(`Corrida finalizada. Você recebeu ${formatBRL(earning)} líquido.`);

    await publishRideEvent({
      type: 'COMPLETE_RIDE',
      rideId: current.id,
    });

    const newCompleted: CompletedDriverRide = {
      id: current.id || `ride-${Date.now()}`,
      date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      origin: current.origin.address || 'Embarque do passageiro',
      destination: current.destination.address || 'Destino final',
      km: current.distanceKm,
      earning,
    };

    try {
      const stored = await AsyncStorage.getItem(COMPLETED_RIDES_KEY);
      const list: CompletedDriverRide[] = stored ? JSON.parse(stored) : [];
      list.unshift(newCompleted);
      await AsyncStorage.setItem(COMPLETED_RIDES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Erro ao salvar corrida concluída:', e);
    }

    Alert.alert('Corrida concluída! 🎉', `Você recebeu ${formatBRL(earning)} líquido (88% do valor total).`, [
      {
        text: 'OK',
        onPress: () => {
          setActiveRide(null);
          setRidePhase('idle');
          loadTodayStats();
        },
      },
    ]);
  };

  const toggleOnline = (val: boolean) => {
    setIsOnline(val);
    if (!val) {
      stopNavigation();
      setRideRequest(null);
      slideAnim.setValue(300);
    }
  };

  const toggleVoice = () => {
    const newState = ttsService.toggleVoice();
    setVoiceEnabled(newState);
  };

  const repeatVoice = () => {
    ttsService.repeat();
  };

  // Marcadores do mapa
  const mapMarkers = activeRide ? [
    {
      latitude: activeRide.origin.latitude,
      longitude: activeRide.origin.longitude,
      title: 'Embarque: ' + activeRide.origin.address,
      type: 'passenger' as const,
    },
    {
      latitude: activeRide.destination.latitude,
      longitude: activeRide.destination.longitude,
      title: 'Destino: ' + activeRide.destination.address,
      type: 'destination' as const,
    },
  ] : [];

  const currentStep = routeSteps[currentStepIndex] || null;

  return (
    <View style={styles.container}>
      {/* Mapa nativo OpenStreetMap (Leaflet) com Carrinho 99 e Trajeto */}
      <OSMMap
        latitude={coords.lat}
        longitude={coords.lng}
        zoom={activeRide ? 16 : 15}
        carPosition={carPosition}
        routeCoordinates={routeCoordinates}
        markers={mapMarkers}
      />

      {/* Banner de navegação GPS com voz TTS no topo */}
      {activeRide && currentStep && (
        <NavigationBanner
          currentStep={currentStep}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
          onRepeatVoice={repeatVoice}
          targetType={ridePhase === 'to_destination' ? 'destination' : 'passenger'}
          targetAddress={ridePhase === 'to_destination' ? activeRide.destination.address : activeRide.origin.address}
        />
      )}

      {/* Spinner enquanto GPS carrega */}
      {!gpsReady && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator color={Colors.amber} size="large" />
          <Text style={styles.gpsText}>Sincronizando GPS do motorista...</Text>
        </View>
      )}

      {/* Header overlay quando não está em navegação ativa */}
      {(!activeRide || !currentStep) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>{driver?.name?.charAt(0) ?? 'A'}</Text>
            </View>
            <View>
              <Text style={styles.driverName}>{driver?.name || 'Motorista Parceiro'}</Text>
              <Text style={styles.vehicleText}>
                {driver?.vehicle ? `${driver.vehicle} · ${driver.vehiclePlate}` : 'Honda Fit · BRA-8888'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Painel inferior de controle e status da corrida */}
      <View style={styles.bottomPanel}>
        {/* Toggle online */}
        <View style={styles.onlineRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineLabel}>
              {isOnline ? '🟢 Online — aguardando chamadas' : '⚫ Offline — desconectado'}
            </Text>
            {isOnline && !activeRide && (
              <Text style={styles.onlineSub}>Conectado em tempo real com passageiros da 88 Mobility</Text>
            )}
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: Colors.darkBorder, true: Colors.success }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Card de corrida ativa e suas fases */}
        {activeRide && (
          <View style={styles.activeRideCard}>
            <View style={styles.activeRideHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeRidePhaseBadge}>
                  {ridePhase === 'to_passenger' && '🟡 A CAMINHO DO PASSAGEIRO'}
                  {ridePhase === 'at_passenger' && '🟢 NO LOCAL DE EMBARQUE'}
                  {ridePhase === 'to_destination' && '🚀 VIAGEM EM ANDAMENTO'}
                </Text>
                <Text style={styles.activeRidePassenger}>
                  Passageiro: {activeRide.passengerName || 'Passageiro'}
                </Text>
              </View>
              <Text style={styles.activeRideEarning}>
                {formatBRL(activeRide.driverShare)}
              </Text>
            </View>

            <Text style={styles.activeRideRoute}>
              {ridePhase === 'to_passenger'
                ? `Buscando em: ${activeRide.origin.address}`
                : `Levando para: ${activeRide.destination.address}`}
            </Text>

            <View style={styles.activeActionButtons}>
              {ridePhase === 'to_passenger' && (
                <TouchableOpacity style={styles.arrivedBtn} onPress={confirmArrivedAtPassenger}>
                  <Text style={styles.arrivedBtnText}>Já cheguei ao passageiro 📍</Text>
                </TouchableOpacity>
              )}

              {ridePhase === 'at_passenger' && (
                <TouchableOpacity style={styles.startTripBtn} onPress={startTripWithPassenger}>
                  <Text style={styles.startTripBtnText}>Iniciar Viagem com Passageiro 🚀</Text>
                </TouchableOpacity>
              )}

              {ridePhase === 'to_destination' && (
                <TouchableOpacity style={styles.completeBtn} onPress={completeRide}>
                  <Text style={styles.completeBtnText}>Finalizar Corrida ✅</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Ganhos REAIS do dia */}
        {!activeRide && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatBRL(completedToday.total)}</Text>
              <Text style={styles.statLabel}>Hoje</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedToday.count}</Text>
              <Text style={styles.statLabel}>Corridas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>5.0 ⭐</Text>
              <Text style={styles.statLabel}>Avaliação</Text>
            </View>
          </View>
        )}
      </View>

      {/* Popup de nova corrida recebida do passageiro */}
      {rideRequest && (
        <Animated.View
          style={[styles.rideRequestSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Chamada de Corrida Disponível 🚀</Text>

          <View style={styles.rideInfo}>
            <View style={styles.rideInfoRow}>
              <Text style={styles.rideInfoIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rideInfoLabel}>Embarque</Text>
                <Text style={styles.rideInfoValue}>{rideRequest.origin.address}</Text>
              </View>
            </View>
            <View style={styles.rideInfoDivider} />
            <View style={styles.rideInfoRow}>
              <Text style={styles.rideInfoIcon}>🏁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rideInfoLabel}>Destino</Text>
                <Text style={styles.rideInfoValue}>{rideRequest.destination.address}</Text>
              </View>
            </View>
          </View>

          <View style={styles.rideMeta}>
            <View style={styles.rideMetaItem}>
              <Text style={styles.rideMetaLabel}>Distância</Text>
              <Text style={styles.rideMetaVal}>{rideRequest.distanceKm} km</Text>
            </View>
            <View style={styles.rideMetaDivider} />
            <View style={styles.rideMetaItem}>
              <Text style={styles.rideMetaLabel}>Seu Ganho (88%)</Text>
              <Text style={styles.rideMetaValAmber}>{formatBRL(rideRequest.driverShare)}</Text>
            </View>
            <View style={styles.rideMetaDivider} />
            <View style={styles.rideMetaItem}>
              <Text style={styles.rideMetaLabel}>Total Corrida</Text>
              <Text style={styles.rideMetaVal}>{formatBRL(rideRequest.totalAmount)}</Text>
            </View>
          </View>

          <View style={styles.sheetButtons}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => dismissRequest()}
              activeOpacity={0.8}
            >
              <Text style={styles.declineBtnText}>Recusar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={acceptRide}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptBtnText}>Aceitar Corrida 🚗</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gpsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  gpsText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  driverName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  vehicleText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    zIndex: 10,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  onlineLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  onlineSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  activeRideCard: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  activeRidePhaseBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activeRidePassenger: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeRideEarning: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  activeRideRoute: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  activeActionButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  arrivedBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  arrivedBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  startTripBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  startTripBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  completeBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 6,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  rideRequestSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderTopWidth: 2,
    borderColor: '#F59E0B',
    elevation: 20,
    zIndex: 100,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#475569',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 14,
  },
  rideInfo: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  rideInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rideInfoIcon: {
    fontSize: 18,
  },
  rideInfoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  rideInfoValue: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  rideInfoDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  rideMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  rideMetaItem: {
    alignItems: 'center',
    flex: 1,
  },
  rideMetaLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2,
  },
  rideMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rideMetaValAmber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F59E0B',
  },
  rideMetaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 14,
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
});
