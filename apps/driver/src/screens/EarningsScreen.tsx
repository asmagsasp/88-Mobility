import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Dados mock de ganhos
const MOCK_EARNINGS = {
  today: 84.00,
  week: 412.50,
  month: 1680.00,
  totalRides: 12,
  totalKm: 148.4,
};

const MOCK_HISTORY = [
  { id: 'r1', date: 'Hoje 14:22', origin: 'Centro', destination: 'Asa Norte', km: 8.4, earning: 18.48 },
  { id: 'r2', date: 'Hoje 12:10', origin: 'Asa Sul', destination: 'Taguatinga', km: 14.2, earning: 31.24 },
  { id: 'r3', date: 'Hoje 10:05', origin: 'Guará', destination: 'Plano Piloto', km: 9.8, earning: 21.56 },
  { id: 'r4', date: 'Ontem 18:32', origin: 'Samambaia', destination: 'Centro', km: 22.1, earning: 48.62 },
  { id: 'r5', date: 'Ontem 16:15', origin: 'Ceilândia', destination: 'Asa Norte', km: 18.7, earning: 41.14 },
];

/**
 * Tela de ganhos do motorista
 */
export function EarningsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.amber} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Ganhos</Text>
        <Text style={styles.headerSub}>Split: 88% seus / 12% plataforma</Text>
      </View>

      {/* Cards de período */}
      <View style={styles.periodCards}>
        <View style={[styles.periodCard, styles.periodCardMain]}>
          <Text style={styles.periodLabel}>Hoje</Text>
          <Text style={styles.periodValue}>{formatBRL(MOCK_EARNINGS.today)}</Text>
          <Text style={styles.periodMeta}>{MOCK_EARNINGS.totalRides} corridas</Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Esta semana</Text>
          <Text style={[styles.periodValue, { fontSize: 20 }]}>{formatBRL(MOCK_EARNINGS.week)}</Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Este mês</Text>
          <Text style={[styles.periodValue, { fontSize: 20 }]}>{formatBRL(MOCK_EARNINGS.month)}</Text>
        </View>
      </View>

      {/* Km rodados */}
      <View style={styles.kmCard}>
        <Text style={styles.kmIcon}>🛣️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.kmValue}>{MOCK_EARNINGS.totalKm} km rodados hoje</Text>
          <Text style={styles.kmSub}>Média de {formatBRL(MOCK_EARNINGS.today / MOCK_EARNINGS.totalKm)}/km</Text>
        </View>
      </View>

      {/* Histórico */}
      <Text style={styles.sectionTitle}>Últimas corridas</Text>
      {MOCK_HISTORY.map(ride => (
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
      ))}
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
});
