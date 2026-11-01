import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

export interface PassengerRideHistoryItem {
  id: string;
  date: string;
  timestamp: number;
  origin: string;
  destination: string;
  km: number;
  total: number;
  driverName: string;
  status: 'completed' | 'cancelled';
}

const STORAGE_KEY = '@88mobility_passenger_history';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Tela de histórico de corridas do passageiro:
 * - Exibe APENAS corridas reais solicitadas pelo passageiro
 * - Zero dados fictícios ou mocks pré-carregados
 */
export function HistoryScreen() {
  const { colors, isDark } = useTheme();
  const [history, setHistory] = useState<PassengerRideHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico do passageiro:', e);
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
    >
      <Text style={[styles.title, { color: colors.text }]}>Histórico de Corridas</Text>

      {history.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma corrida realizada ainda</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Suas viagens solicitadas e concluídas com motoristas parceiros aparecerão aqui com detalhamento de valor.
          </Text>
        </View>
      ) : (
        history.map(ride => (
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

            {ride.driverName && (
              <Text style={[styles.driverTag, { color: colors.textSecondary }]}>
                Motorista: {ride.driverName}
              </Text>
            )}

            <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.km, { color: colors.textSecondary }]}>{ride.km} km</Text>
              <Text style={[styles.total, { color: colors.amber }]}>{formatBRL(ride.total)}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
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
  routeText: { fontSize: 14, flex: 1, fontWeight: '500' },
  driverTag: { fontSize: 12, marginTop: 4, marginBottom: 6 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  km:    { fontSize: 13 },
  total: { fontSize: 18, fontWeight: '700' },

  emptyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  emptyIcon:  { fontSize: 36, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
