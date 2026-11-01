import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, Dimensions, Switch, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { OSMMap } from '../components/OSMMap';
import type { Ride } from '../types';
import type { CompletedDriverRide } from './EarningsScreen';
import {
  publishRideEvent,
  pollRideEvents,
  type SyncRidePayload,
} from '../services/rideSync';

const { height } = Dimensions.get('window');
const COMPLETED_RIDES_KEY = '@88mobility_driver_completed_rides';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Tela principal do motorista:
 * - Mapa centrado na localização real GPS
 * - Toggle Online/Offline
 * - Sincronização em tempo real com o aplicativo do passageiro: recebe chamadas ao vivo!
 * - Ao recusar uma corrida, ela NUNCA mais é reoferecida
 */
export function HomeScreen() {
  const { driver, logout } = useAuth();
  const [coords, setCoords]           = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 });
  const [gpsReady, setGpsReady]       = useState(false);
  const [isOnline, setIsOnline]       = useState(false);
  const [rideRequest, setRideRequest] = useState<SyncRidePayload | null>(null);
  const [activeRide, setActiveRide]   = useState<SyncRidePayload | null>(null);
  const [completedToday, setCompletedToday] = useState<{ total: number; count: number }>({ total: 0, count: 0 });

  // Timestamp em segundos da última checagem de mensagens no canal
  const lastPollTime = useRef<number>(Math.floor(Date.now() / 1000) - 60);

  // Conjunto de IDs de corridas que o motorista já recusou para JAMAIS reoferecê-las
  const rejectedRideIds = useRef<Set<string>>(new Set());
  const slideAnim = useRef(new Animated.Value(300)).current;

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

  // Solicita permissão e obtém localização real
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
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
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
            // Se já foi recusada, ou se já está atendendo outra, ignora
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
              setActiveRide(null);
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

  // Recusar corrida: fecha popup, avisa passageiro e marca ID como permanentemente recusada
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

  // Aceitar corrida e avisar o aplicativo do passageiro em tempo real
  const acceptRide = async () => {
    if (!rideRequest) return;
    const current = rideRequest;

    await publishRideEvent({
      type: 'ACCEPT_RIDE',
      rideId: current.id,
      driver: {
        name: driver?.name || 'Abel Magalhães',
        vehicle: driver?.vehicle || 'Toyota Corolla 2023',
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
  };

  // Concluir corrida, notificar passageiro e persistir ganho real no histórico
  const completeRide = async () => {
    if (!activeRide) return;
    const current = activeRide;
    const earning = current.driverShare;

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
          loadTodayStats();
        },
      },
    ]);
  };

  const toggleOnline = (val: boolean) => {
    setIsOnline(val);
    if (!val) {
      setRideRequest(null);
      slideAnim.setValue(300);
    }
  };

  return (
    <View style={styles.container}>
      {/* Mapa nativo OpenStreetMap (Leaflet) sem dependência de serviços do Google */}
      <OSMMap
        latitude={coords.lat}
        longitude={coords.lng}
        zoom={15}
        markers={activeRide ? [
          { latitude: activeRide.origin.latitude, longitude: activeRide.origin.longitude, title: 'Embarque do Passageiro' },
          { latitude: activeRide.destination.latitude, longitude: activeRide.destination.longitude, title: 'Destino Final' },
        ] : []}
      />

      {/* Spinner enquanto GPS carrega */}
      {!gpsReady && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator color={Colors.amber} size="large" />
          <Text style={styles.gpsText}>Sincronizando GPS do motorista...</Text>
        </View>
      )}

      {/* Header overlay */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>{driver?.name?.charAt(0) ?? 'A'}</Text>
          </View>
          <View>
            <Text style={styles.driverName}>{driver?.name || 'Motorista Parceiro'}</Text>
            <Text style={styles.vehicleText}>{driver?.vehicle ? `${driver.vehicle} · ${driver.vehiclePlate}` : (driver?.vehiclePlate || 'Veículo Cadastrado')}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Painel inferior */}
      <View style={styles.bottomPanel}>
        {/* Toggle online */}
        <View style={styles.onlineRow}>
          <View>
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

        {/* Corrida ativa */}
        {activeRide && (
          <View style={styles.activeRideCard}>
            <View style={styles.activeRideHeader}>
              <Text style={styles.activeRideTitle}>🚗 Corrida em andamento</Text>
              <Text style={styles.activeRideEarning}>
                {formatBRL(activeRide.driverShare)}
              </Text>
            </View>
            <Text style={styles.activeRideRoute}>
              {activeRide.origin.address} → {activeRide.destination.address}
            </Text>
            <Text style={styles.activeRideDist}>
              {activeRide.distanceKm} km · {activeRide.estimatedMinutes} min estimados
            </Text>
            <TouchableOpacity style={styles.completeBtn} onPress={completeRide}>
              <Text style={styles.completeBtnText}>Finalizar corrida</Text>
            </TouchableOpacity>
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

      {/* Popup de nova corrida recebida em tempo real do passageiro */}
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
              <Text style={styles.rideMetaValue}>{rideRequest.distanceKm} km</Text>
              <Text style={styles.rideMetaLabel}>Distância</Text>
            </View>
            <View style={styles.rideMetaItem}>
              <Text style={styles.rideMetaValue}>{rideRequest.estimatedMinutes} min</Text>
              <Text style={styles.rideMetaLabel}>Tempo</Text>
            </View>
            <View style={styles.rideMetaItem}>
              <Text style={[styles.rideMetaValue, { color: Colors.amber }]}>
                {formatBRL(rideRequest.driverShare)}
              </Text>
              <Text style={styles.rideMetaLabel}>Seu repasse (88%)</Text>
            </View>
          </View>

          <View style={styles.rideActions}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => dismissRequest(rideRequest.id)}
            >
              <Text style={styles.declineBtnText}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={acceptRide}>
              <Text style={styles.acceptBtnText}>Aceitar Corrida</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  map: { ...StyleSheet.absoluteFill },

  // Header
  header: {
    position: 'absolute',
    top: 52,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 18, fontWeight: '700', color: Colors.dark },
  driverName:  { fontSize: 15, fontWeight: '700', color: Colors.white },
  vehicleText: { fontSize: 12, color: Colors.slate400, marginTop: 1 },
  logoutBtn:   { paddingVertical: 4, paddingHorizontal: 8 },
  logoutText:  { color: Colors.slate400, fontSize: 13 },

  // Painel inferior
  bottomPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.darkCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.darkBorder,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  onlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  onlineLabel: { fontSize: 15, fontWeight: '700', color: Colors.white },
  onlineSub:   { fontSize: 12, color: Colors.slate400, marginTop: 2 },

  // Corrida ativa
  activeRideCard: {
    backgroundColor: Colors.dark,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.amber + '60',
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  activeRideTitle:   { fontSize: 14, fontWeight: '700', color: Colors.white },
  activeRideEarning: { fontSize: 20, fontWeight: '800', color: Colors.amber },
  activeRideRoute:   { fontSize: 13, color: Colors.slate200, marginBottom: 4 },
  activeRideDist:    { fontSize: 12, color: Colors.slate500, marginBottom: Spacing.md },
  completeBtn: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Stats reais
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.dark,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 18, fontWeight: '800', color: Colors.white },
  statLabel:   { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.darkBorder },

  // Popup de chamada recebida
  rideRequestSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.darkCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: 36,
    borderTopWidth: 2,
    borderTopColor: Colors.amber,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.darkBorder, alignSelf: 'center', marginBottom: Spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: Spacing.md, textAlign: 'center' },
  rideInfo: {
    backgroundColor: Colors.dark,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.md,
  },
  rideInfoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rideInfoIcon:    { fontSize: 18 },
  rideInfoLabel:   { fontSize: 11, color: Colors.slate500 },
  rideInfoValue:   { fontSize: 13, color: Colors.white, fontWeight: '600', marginTop: 1 },
  rideInfoDivider: { height: 1, backgroundColor: Colors.darkBorder, marginVertical: Spacing.xs, marginLeft: 28 },

  rideMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dark,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  rideMetaItem:  { alignItems: 'center' },
  rideMetaValue: { fontSize: 16, fontWeight: '800', color: Colors.white },
  rideMetaLabel: { fontSize: 11, color: Colors.slate500, marginTop: 2 },

  rideActions: { flexDirection: 'row', gap: Spacing.md },
  declineBtn: {
    flex: 1,
    backgroundColor: Colors.danger + '20',
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  declineBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 15 },
  acceptBtn: {
    flex: 2,
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptBtnText: { color: Colors.dark, fontWeight: '800', fontSize: 15 },

  gpsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsText: { color: Colors.slate200, marginTop: 12, fontSize: 14, fontWeight: '500' },
});
