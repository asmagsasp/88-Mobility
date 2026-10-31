import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, Dimensions, Switch, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { OSMMap } from '../components/OSMMap';
import type { Ride } from '../types';

const { height } = Dimensions.get('window');

// Mock de corrida recebida — coordenadas serão ajustadas para perto do usuário
const makeMockRide = (lat: number, lng: number): Ride => ({
  id: 'r-mock-001',
  passengerId: 'p1',
  passengerName: 'Ana Silva',
  origin:      { latitude: lat + 0.005, longitude: lng + 0.005, address: 'Perto de você' },
  destination: { latitude: lat - 0.010, longitude: lng - 0.008, address: 'Destino próximo' },
  distanceKm: 8.4,
  pricePerKm: 2.50,
  surgeFee: 0,
  totalAmount: 21.00,
  driverShare: 18.48,
  platformShare: 2.52,
  status: 'searching',
  requestedAt: new Date().toISOString(),
  estimatedMinutes: 12,
});

// Região padrão enquanto GPS carrega
const FALLBACK_COORDS = {
  latitude: -15.7942,
  longitude: -47.8822,
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Tela principal do motorista:
 * - Mapa centrado na localização real do usuário
 * - Toggle Online/Offline
 * - Popup de corrida disponível (aceitar/recusar)
 * - Ganhos do dia
 */
export function HomeScreen() {
  const { driver, logout } = useAuth();
  const [coords, setCoords]           = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 });
  const [gpsReady, setGpsReady]       = useState(false);
  const [isOnline, setIsOnline]       = useState(false);
  const [rideRequest, setRideRequest] = useState<Ride | null>(null);
  const [activeRide, setActiveRide]   = useState<Ride | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

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

  // Simula recebimento de corrida após 3s quando online
  useEffect(() => {
    if (!isOnline || rideRequest || activeRide || !gpsReady) return;
    const t = setTimeout(() => {
      const mockRide = makeMockRide(coords.lat, coords.lng);
      setRideRequest(mockRide);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65 }).start();
    }, 3000);
    return () => clearTimeout(t);
  }, [isOnline, rideRequest, activeRide, gpsReady, coords]);

  const dismissRequest = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }).start(() => {
      setRideRequest(null);
      slideAnim.setValue(300);
    });
  };

  const acceptRide = () => {
    if (!rideRequest) return;
    setActiveRide({ ...rideRequest, status: 'arriving' });
    dismissRequest();
  };

  const completeRide = () => {
    Alert.alert('Corrida concluída! 🎉', `Você ganhou ${formatBRL(activeRide?.driverShare ?? 0)}`, [
      { text: 'OK', onPress: () => setActiveRide(null) },
    ]);
  };

  const toggleOnline = (val: boolean) => {
    setIsOnline(val);
    if (!val) { setRideRequest(null); slideAnim.setValue(300); }
  };

  return (
    <View style={styles.container}>
      {/* Mapa 100% nativo OpenStreetMap (nunca fecha ou trava por falta de Google API Key) */}
      <OSMMap
        latitude={coords.lat}
        longitude={coords.lng}
        zoom={15}
        markers={activeRide ? [
          { latitude: activeRide.origin.latitude, longitude: activeRide.origin.longitude, title: 'Passageiro' },
          { latitude: activeRide.destination.latitude, longitude: activeRide.destination.longitude, title: 'Destino' },
        ] : []}
      />

      {/* Spinner enquanto GPS carrega */}
      {!gpsReady && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator color={Colors.amber} size="large" />
          <Text style={styles.gpsText}>Obtendo localização...</Text>
        </View>
      )}

      {/* Header overlay */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>{driver?.name?.charAt(0) ?? 'M'}</Text>
          </View>
          <View>
            <Text style={styles.driverName}>{driver?.name}</Text>
            <Text style={styles.vehicleText}>{driver?.vehiclePlate}</Text>
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
              {isOnline ? '🟢 Online — aguardando corrida' : '⚫ Offline'}
            </Text>
            {isOnline && !activeRide && (
              <Text style={styles.onlineSub}>Procurando corridas próximas...</Text>
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

        {/* Ganhos do dia */}
        {!activeRide && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>R$ 84,00</Text>
              <Text style={styles.statLabel}>Hoje</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Corridas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.8 ⭐</Text>
              <Text style={styles.statLabel}>Avaliação</Text>
            </View>
          </View>
        )}
      </View>

      {/* Popup de nova corrida */}
      {rideRequest && (
        <Animated.View
          style={[styles.rideRequestSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Nova corrida disponível! 🚀</Text>

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
              <Text style={styles.rideMetaLabel}>Estimado</Text>
            </View>
            <View style={styles.rideMetaItem}>
              <Text style={[styles.rideMetaValue, { color: Colors.amber }]}>
                {formatBRL(rideRequest.driverShare)}
              </Text>
              <Text style={styles.rideMetaLabel}>Seus ganhos</Text>
            </View>
          </View>

          <View style={styles.rideActions}>
            <TouchableOpacity style={styles.declineBtn} onPress={dismissRequest}>
              <Text style={styles.declineBtnText}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={acceptRide}>
              <Text style={styles.acceptBtnText}>Aceitar</Text>
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
  driverName:  { fontSize: 14, fontWeight: '600', color: Colors.white },
  vehicleText: { fontSize: 12, color: Colors.slate400, marginTop: 1 },
  logoutBtn:   { padding: 8 },
  logoutText:  { color: Colors.slate400, fontSize: 13 },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.darkCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.darkBorder,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  onlineLabel: { fontSize: 15, fontWeight: '600', color: Colors.white },
  onlineSub:   { fontSize: 12, color: Colors.slate400, marginTop: 2 },

  // Active ride
  activeRideCard: {
    backgroundColor: Colors.dark,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.amber + '40',
    marginTop: Spacing.sm,
  },
  activeRideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  activeRideTitle:  { fontSize: 14, fontWeight: '600', color: Colors.white },
  activeRideEarning:{ fontSize: 20, fontWeight: '800', color: Colors.amber },
  activeRideRoute:  { fontSize: 13, color: Colors.slate400, marginBottom: 4 },
  activeRideDist:   { fontSize: 12, color: Colors.slate500, marginBottom: Spacing.md },
  completeBtn: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 16, fontWeight: '700', color: Colors.white },
  statLabel:   { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.darkBorder },

  // Ride request sheet
  rideRequestSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.darkCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: Colors.darkBorder,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.darkBorder, alignSelf: 'center', marginBottom: Spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: Spacing.md },

  rideInfo: {
    backgroundColor: Colors.dark,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  rideInfoRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rideInfoIcon:    { fontSize: 18, marginTop: 2 },
  rideInfoLabel:   { fontSize: 11, color: Colors.slate500, marginBottom: 2 },
  rideInfoValue:   { fontSize: 14, color: Colors.white, fontWeight: '500' },
  rideInfoDivider: { height: 1, backgroundColor: Colors.darkBorder, marginVertical: Spacing.sm, marginLeft: 28 },

  rideMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.dark,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  rideMetaItem:  { alignItems: 'center' },
  rideMetaValue: { fontSize: 18, fontWeight: '700', color: Colors.white },
  rideMetaLabel: { fontSize: 11, color: Colors.slate400, marginTop: 2 },

  rideActions: { flexDirection: 'row', gap: Spacing.md },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineBtnText: { color: Colors.slate200, fontWeight: '600', fontSize: 15 },
  acceptBtn: {
    flex: 2,
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.amber,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  acceptBtnText: { color: Colors.dark, fontWeight: '700', fontSize: 16 },

  // GPS loading overlay
  gpsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.dark + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsText: { color: Colors.slate400, marginTop: 12, fontSize: 14 },
});
