import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, FlatList, Alert, ActivityIndicator, Image,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Ride, Location as RideLocation } from '../types';

type Step = 'idle' | 'selecting_destination' | 'confirming' | 'searching' | 'active';

// Sugestões de destinos mock
const SUGGESTIONS = [
  { id: '1', label: 'Aeroporto Internacional de Brasília', address: 'SAIN - Asa Norte', lat: -15.8711, lng: -47.9172 },
  { id: '2', label: 'Shopping Brasília', address: 'Asa Norte - Brasília', lat: -15.7399, lng: -47.9109 },
  { id: '3', label: 'Universidade de Brasília (UnB)', address: 'Asa Norte', lat: -15.7627, lng: -47.8700 },
  { id: '4', label: 'Parque da Cidade', address: 'Asa Sul - Brasília', lat: -15.8122, lng: -47.9148 },
  { id: '5', label: 'Rodoviária do Plano Piloto', address: 'Centro - Brasília', lat: -15.7942, lng: -47.8822 },
];

const FALLBACK_REGION: Region = {
  latitude: -15.7942,
  longitude: -47.8822,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const PRICE_PER_KM   = 2.50;
const SURGE_FEE      = 2.00; // horário de pico ativo (mock)
const PLATFORM_FEE   = 2.00; // Taxa fixa de manutenção da plataforma
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Tela principal do passageiro:
 * - Mapa OpenStreetMap
 * - Busca de destino
 * - Confirmação de corrida com preço
 * - Acompanhamento do motorista
 */
export function HomeScreen() {
  const { passenger, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const [region, setRegion]         = useState<Region>(FALLBACK_REGION);
  const [gpsReady, setGpsReady]     = useState(false);
  const [step, setStep]             = useState<Step>('idle');
  const [search, setSearch]         = useState('');
  const [destination, setDest]      = useState<typeof SUGGESTIONS[0] | null>(null);
  const [activeRide, setActiveRide] = useState<Partial<Ride> | null>(null);
  const mapRef = useRef<MapView>(null);

  const ORIGIN: RideLocation = {
    latitude: region.latitude,
    longitude: region.longitude,
    address: 'Sua localização',
  };

  // Solicita permissão e obtém localização real
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsReady(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const userRegion: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(userRegion);
      setGpsReady(true);
      mapRef.current?.animateToRegion(userRegion, 800);
    })();
  }, []);

  const distanceKm   = destination ? parseFloat((Math.random() * 8 + 2).toFixed(1)) : 0;
  const kmAmount     = distanceKm * PRICE_PER_KM;
  const totalAmount  = kmAmount + SURGE_FEE + PLATFORM_FEE;

  const selectDestination = (item: typeof SUGGESTIONS[0]) => {
    setDest(item);
    setStep('confirming');
    setSearch(item.label);
  };

  const requestRide = () => {
    setStep('searching');
    // Simula motorista sendo encontrado após 2s
    setTimeout(() => {
      setActiveRide({
        id: 'ride-001',
        driverName: 'Carlos Oliveira',
        driverVehicle: 'Toyota Corolla',
        driverPlate: 'ABC-1234',
        driverRating: 4.8,
        estimatedMinutes: 5,
        totalAmount,
        status: 'arriving',
      });
      setStep('active');
    }, 2000);
  };

  const cancelRide = () => {
    Alert.alert('Cancelar corrida?', 'Taxa de cancelamento pode ser aplicada.', [
      { text: 'Não', style: 'cancel' },
      { text: 'Cancelar corrida', style: 'destructive', onPress: () => { setActiveRide(null); setStep('idle'); setDest(null); setSearch(''); } },
    ]);
  };

  const filteredSuggestions = SUGGESTIONS.filter(s =>
    !search || s.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Mapa centrado na localização real */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
      >
        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destination.label}
            pinColor={Colors.amber}
          />
        )}
      </MapView>

      {/* Spinner enquanto GPS carrega */}
      {!gpsReady && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator color={Colors.amber} size="large" />
          <Text style={styles.gpsText}>Obtendo localização...</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.headerLogoImage}
          resizeMode="contain"
        />
        <Text style={[styles.headerGreeting, { color: colors.text }]}>Olá, {passenger?.name?.split(' ')[0]}!</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Corrida ativa */}
      {step === 'active' && activeRide && (
        <View style={styles.activeSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {activeRide.driverName?.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{activeRide.driverName}</Text>
              <Text style={styles.driverVehicle}>
                {activeRide.driverVehicle} · {activeRide.driverPlate}
              </Text>
              <Text style={styles.driverRating}>⭐ {activeRide.driverRating}</Text>
            </View>
            <View style={styles.etaBox}>
              <Text style={styles.etaMin}>{activeRide.estimatedMinutes}</Text>
              <Text style={styles.etaLabel}>min</Text>
            </View>
          </View>

          <View style={styles.activeRoute}>
            <Text style={styles.activeRouteText}>🟢 Sua localização</Text>
            <Text style={styles.activeRouteArrow}>↓</Text>
            <Text style={styles.activeRouteText}>🏁 {destination?.label}</Text>
          </View>

          <View style={styles.activeTotal}>
            <Text style={styles.activeTotalLabel}>Total estimado</Text>
            <Text style={styles.activeTotalValue}>{formatBRL(totalAmount)}</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancelRide}>
            <Text style={styles.cancelBtnText}>Cancelar corrida</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Buscando motorista */}
      {step === 'searching' && (
        <View style={styles.searchingSheet}>
          <View style={styles.sheetHandle} />
          <ActivityIndicator size="large" color={Colors.amber} style={{ marginBottom: 16 }} />
          <Text style={styles.searchingTitle}>Buscando motorista...</Text>
          <Text style={styles.searchingSubtitle}>Aguarde, estamos encontrando o melhor motorista para você</Text>
        </View>
      )}

      {/* Painel de busca / confirmação (idle + selecting + confirming) */}
      {(step === 'idle' || step === 'selecting_destination' || step === 'confirming') && (
        <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Campo de busca */}
          <View style={[styles.searchBox, { backgroundColor: colors.slate100, borderColor: colors.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={(t) => { setSearch(t); setStep('selecting_destination'); }}
              placeholder="Para onde você vai?"
              placeholderTextColor={colors.textMuted}
              onFocus={() => setStep('selecting_destination')}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setDest(null); setStep('idle'); }}>
                <Text style={{ color: colors.slate400, fontSize: 18, paddingHorizontal: 8 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sugestões */}
          {step === 'selecting_destination' && (
            <FlatList
              data={filteredSuggestions}
              keyExtractor={i => i.id}
              style={styles.suggestions}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => selectDestination(item)}>
                  <Text style={styles.suggestionIcon}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text style={[styles.suggestionAddress, { color: colors.textSecondary }]}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            />
          )}

          {/* Confirmação de corrida */}
          {step === 'confirming' && destination && (
            <View style={styles.confirmPanel}>
              {/* Resumo da rota */}
              <View style={[styles.routeCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
                <View style={styles.routeRow}>
                  <Text style={styles.routeDot}>🟢</Text>
                  <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>Sua localização</Text>
                </View>
                <View style={[styles.routeDivLine, { backgroundColor: colors.border }]} />
                <View style={styles.routeRow}>
                  <Text style={styles.routeDot}>🏁</Text>
                  <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>{destination.label}</Text>
                </View>
              </View>

              {/* Preço detalhado */}
              <View style={[styles.priceCard, { backgroundColor: colors.slate50, borderColor: colors.border }]}>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{distanceKm} km × {formatBRL(PRICE_PER_KM)}/km</Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>{formatBRL(kmAmount)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: Colors.warning }]}>⚡ Horário de pico</Text>
                  <Text style={[styles.priceValue, { color: Colors.warning }]}>+ {formatBRL(SURGE_FEE)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>🛡️ Taxa de manutenção</Text>
                  <Text style={[styles.priceValue, { color: colors.textMuted }]}>+ {formatBRL(PLATFORM_FEE)}</Text>
                </View>
                <View style={[styles.priceRow, styles.priceTotalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.priceTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.priceTotalValue, { color: colors.amber }]}>{formatBRL(totalAmount)}</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.requestBtn, { backgroundColor: colors.amber }]} onPress={requestRide} activeOpacity={0.85}>
                <Text style={styles.requestBtnText}>Solicitar corrida</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Atalhos rápidos (estado idle) */}
          {step === 'idle' && (
            <View style={styles.quickActions}>
              <Text style={[styles.quickTitle, { color: colors.textSecondary }]}>Destinos frequentes</Text>
              <View style={styles.quickRow}>
                {[
                  { icon: '🏠', label: 'Casa', sub: 'Asa Norte' },
                  { icon: '💼', label: 'Trabalho', sub: 'Centro' },
                  { icon: '🛒', label: 'Shopping', sub: 'Asa Norte' },
                ].map((q) => (
                  <TouchableOpacity
                    key={q.label}
                    style={[styles.quickItem, { backgroundColor: colors.slate100, borderColor: colors.border }]}
                    onPress={() => { setSearch(q.label); setStep('selecting_destination'); }}
                  >
                    <Text style={styles.quickIcon}>{q.icon}</Text>
                    <Text style={[styles.quickLabel, { color: colors.text }]}>{q.label}</Text>
                    <Text style={[styles.quickSub, { color: colors.textSecondary }]}>{q.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map:       { ...StyleSheet.absoluteFill },

  // Header
  header: {
    position: 'absolute',
    top: 52,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerLogoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerGreeting:  { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  logoutText:      { color: Colors.slate400, fontSize: 13 },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 32,
    paddingTop: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md,
  },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  // Suggestions
  suggestions:      { maxHeight: 240 },
  suggestionItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  suggestionIcon:   { fontSize: 18 },
  suggestionLabel:  { fontSize: 14, fontWeight: '500', color: Colors.text },
  suggestionAddress:{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  separator:        { height: 1, backgroundColor: Colors.border },

  // Confirm panel
  confirmPanel: { gap: Spacing.md },
  routeCard: {
    backgroundColor: Colors.slate50,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot:     { fontSize: 16 },
  routeText:    { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  routeDivLine: { height: 16, width: 1, backgroundColor: Colors.border, marginLeft: 12, marginVertical: 2 },

  priceCard: {
    backgroundColor: Colors.slate50,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  priceRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel:     { fontSize: 14, color: Colors.textSecondary },
  priceValue:     { fontSize: 14, color: Colors.text, fontWeight: '500' },
  priceTotalRow:  { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 2 },
  priceTotalLabel:{ fontSize: 15, fontWeight: '700', color: Colors.text },
  priceTotalValue:{ fontSize: 18, fontWeight: '800', color: Colors.amber },

  requestBtn: {
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: Colors.amber,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  requestBtnText: { color: Colors.slate900, fontWeight: '700', fontSize: 16 },

  // Quick actions
  quickActions: { gap: Spacing.sm },
  quickTitle:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  quickRow:     { flexDirection: 'row', gap: Spacing.sm },
  quickItem: {
    flex: 1,
    backgroundColor: Colors.slate100,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickIcon:  { fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  quickSub:   { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  // Searching sheet
  searchingSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: 48,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  searchingTitle:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  searchingSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Active ride sheet
  activeSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    paddingBottom: 36,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.slate50,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 20, fontWeight: '700', color: Colors.slate900 },
  driverName:       { fontSize: 15, fontWeight: '600', color: Colors.text },
  driverVehicle:    { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  driverRating:     { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  etaBox:           { alignItems: 'center' },
  etaMin:           { fontSize: 28, fontWeight: '800', color: Colors.amber },
  etaLabel:         { fontSize: 11, color: Colors.textSecondary },

  activeRoute: {
    backgroundColor: Colors.slate50,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  activeRouteText:  { fontSize: 14, color: Colors.text },
  activeRouteArrow: { fontSize: 12, color: Colors.textSecondary, paddingLeft: 16 },

  activeTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeTotalLabel: { fontSize: 14, color: Colors.textSecondary },
  activeTotalValue: { fontSize: 22, fontWeight: '800', color: Colors.amber },

  cancelBtn: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelBtnText: { color: Colors.danger, fontWeight: '600', fontSize: 15 },

  // GPS loading overlay
  gpsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248,250,252,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsText: { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },
});
