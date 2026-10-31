import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MOCK_HISTORY = [
  { id: 'r1', date: '30/10 14:22', origin: 'Centro', destination: 'Asa Norte', km: 8.4, total: 23.00, status: 'completed' },
  { id: 'r2', date: '30/10 12:10', origin: 'Asa Sul', destination: 'Shopping', km: 6.2, total: 17.50, status: 'completed' },
  { id: 'r3', date: '29/10 20:45', origin: 'Aeroporto', destination: 'Sudoeste', km: 18.4, total: 48.00, status: 'completed' },
  { id: 'r4', date: '29/10 15:30', origin: 'UnB', destination: 'Guará', km: 12.1, total: 32.25, status: 'cancelled' },
];

/**
 * Tela de histórico de corridas do passageiro com suporte a tema
 */
export function HistoryScreen() {
  const { colors, isDark } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Histórico de corridas</Text>

      {MOCK_HISTORY.map(ride => (
        <TouchableOpacity
          key={ride.id}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{ride.date}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: ride.status === 'completed' ? colors.successLight : colors.dangerLight },
            ]}>
              <Text style={[
                styles.statusText,
                { color: ride.status === 'completed' ? colors.success : colors.danger },
              ]}>
                {ride.status === 'completed' ? 'Concluída' : 'Cancelada'}
              </Text>
            </View>
          </View>
          <View style={styles.route}>
            <Text style={styles.routeIcon}>🟢</Text>
            <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>{ride.origin}</Text>
          </View>
          <View style={styles.route}>
            <Text style={styles.routeIcon}>🏁</Text>
            <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>{ride.destination}</Text>
          </View>
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.km, { color: colors.textSecondary }]}>{ride.km} km</Text>
            <Text style={[styles.total, { color: colors.amber }]}>{formatBRL(ride.total)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: Spacing.lg, paddingBottom: 40 },
  title:     { fontSize: 22, fontWeight: '800', marginBottom: Spacing.lg },

  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date:       { fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  route:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  routeIcon: { fontSize: 13 },
  routeText: { fontSize: 14, flex: 1 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 8,
  },
  km:    { fontSize: 13 },
  total: { fontSize: 16, fontWeight: '700' },
});
