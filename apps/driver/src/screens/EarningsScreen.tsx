import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export interface CompletedDriverRide {
  id: string;
  date: string;
  timestamp: number;
  origin: string;
  destination: string;
  km: number;
  earning: number;
}

const STORAGE_KEY = '@88mobility_driver_completed_rides';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Tela de ganhos do motorista:
 * - Exibe APENAS dados reais calculados a partir das corridas concluídas pelo motorista
 * - Zero dados fictícios ou mocks pré-carregados
 */
export function EarningsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [rides, setRides] = useState<CompletedDriverRide[]>([]);

  const loadEarnings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CompletedDriverRide[] = JSON.parse(stored);
        setRides(parsed);
      } else {
        setRides([]);
      }
    } catch (e) {
      console.warn('Erro ao carregar ganhos do motorista:', e);
      setRides([]);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEarnings();
    setRefreshing(false);
  };

  // Cálculo de dados reais
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;

  const todayRides = rides.filter(r => (now - r.timestamp) <= oneDayMs);
  const weekRides  = rides.filter(r => (now - r.timestamp) <= oneWeekMs);
  const monthRides = rides.filter(r => (now - r.timestamp) <= oneMonthMs);

  const todayEarnings = todayRides.reduce((acc, r) => acc + r.earning, 0);
  const weekEarnings  = weekRides.reduce((acc, r) => acc + r.earning, 0);
  const monthEarnings = monthRides.reduce((acc, r) => acc + r.earning, 0);

  const todayKm = todayRides.reduce((acc, r) => acc + r.km, 0);
  const averageKmRate = todayKm > 0 ? todayEarnings / todayKm : 2.20; // 88% de R$ 2,50 = R$ 2,20/km

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.amber} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Ganhos</Text>
        <Text style={styles.headerSub}>Repasse transparente: 88% direto para você</Text>
      </View>

      {/* Cards de período */}
      <View style={styles.periodCards}>
        <View style={[styles.periodCard, styles.periodCardMain]}>
          <Text style={styles.periodLabel}>Hoje</Text>
          <Text style={styles.periodValue}>{formatBRL(todayEarnings)}</Text>
          <Text style={styles.periodMeta}>{todayRides.length} {todayRides.length === 1 ? 'corrida' : 'corridas'}</Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Esta semana</Text>
          <Text style={[styles.periodValue, { fontSize: 20 }]}>{formatBRL(weekEarnings)}</Text>
          <Text style={styles.periodMeta}>{weekRides.length} {weekRides.length === 1 ? 'corrida' : 'corridas'}</Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Este mês</Text>
          <Text style={[styles.periodValue, { fontSize: 20 }]}>{formatBRL(monthEarnings)}</Text>
          <Text style={styles.periodMeta}>{monthRides.length} {monthRides.length === 1 ? 'corrida' : 'corridas'}</Text>
        </View>
      </View>

      {/* Km rodados */}
      <View style={styles.kmCard}>
        <Text style={styles.kmIcon}>🛣️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.kmValue}>{todayKm.toFixed(1)} km rodados hoje</Text>
          <Text style={styles.kmSub}>
            {todayKm > 0 ? `Média de ${formatBRL(averageKmRate)}/km líquido` : 'Seus km rodados aparecerão aqui'}
          </Text>
        </View>
      </View>

      {/* Histórico real */}
      <Text style={styles.sectionTitle}>Últimas corridas</Text>

      {rides.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>Nenhuma corrida realizada ainda</Text>
          <Text style={styles.emptySub}>
            Fique online na aba Início para receber chamadas de passageiros e começar a faturar.
          </Text>
        </View>
      ) : (
        rides.map(ride => (
          <View key={ride.id} style={styles.rideCard}>
            <View style={styles.rideLeft}>
              <Text style={styles.rideDate}>{ride.date}</Text>
              <Text style={styles.rideRoute} numberOfLines={1}>
                {ride.origin} → {ride.destination}
              </Text>
              <Text style={styles.rideKm}>{ride.km} km</Text>
            </View>
            <Text style={styles.rideEarning}>{formatBRL(ride.earning)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content:   { padding: Spacing.lg, paddingBottom: 40 },
  header: { marginBottom: Spacing.lg },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 13, color: Colors.slate400, marginTop: 4 },

  periodCards: { gap: Spacing.sm, marginBottom: Spacing.md },
  periodCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  periodCardMain: {
    borderColor: Colors.amber + '50',
    backgroundColor: Colors.amber + '12',
  },
  periodLabel: { fontSize: 13, color: Colors.slate400, marginBottom: 4 },
  periodValue: { fontSize: 28, fontWeight: '800', color: Colors.amber },
  periodMeta:  { fontSize: 12, color: Colors.slate500, marginTop: 4 },

  kmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.lg,
  },
  kmIcon:  { fontSize: 28 },
  kmValue: { fontSize: 15, fontWeight: '600', color: Colors.white },
  kmSub:   { fontSize: 12, color: Colors.slate400, marginTop: 2 },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.white,
    marginBottom: Spacing.sm,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  rideLeft:    { flex: 1, marginRight: Spacing.md },
  rideDate:    { fontSize: 11, color: Colors.slate500, marginBottom: 2 },
  rideRoute:   { fontSize: 14, color: Colors.white, fontWeight: '500' },
  rideKm:      { fontSize: 12, color: Colors.slate400, marginTop: 2 },
  rideEarning: { fontSize: 18, fontWeight: '700', color: Colors.amber },

  emptyCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginTop: Spacing.sm,
  },
  emptyIcon:  { fontSize: 36, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  emptySub:   { fontSize: 13, color: Colors.slate400, textAlign: 'center', lineHeight: 18 },
});
