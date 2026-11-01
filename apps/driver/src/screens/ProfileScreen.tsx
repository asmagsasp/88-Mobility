import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import type { CompletedDriverRide } from './EarningsScreen';

const STORAGE_KEY = '@88mobility_driver_completed_rides';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProfileScreen() {
  const { driver, logout } = useAuth();
  const [completedRides, setCompletedRides] = useState<CompletedDriverRide[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setCompletedRides(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Erro ao carregar histórico do perfil:', e);
      }
    })();
  }, []);

  const totalEarningsMonth = completedRides.reduce((acc, r) => acc + r.earning, 0);
  const totalRidesCount = completedRides.length;

  const menuItems = [
    { icon: '🚗', label: 'Meu veículo', sub: `${driver?.vehicle ?? 'Toyota Corolla 2023'} · ${driver?.vehiclePlate ?? 'BRA-8888'}` },
    { icon: '📋', label: 'Documentos', sub: 'CNH, CRLV, antecedentes validados' },
    { icon: '💳', label: 'Dados bancários', sub: 'Chave PIX cadastrada para repasse' },
    { icon: '🔔', label: 'Notificações', sub: 'Avisos de novas corridas e pagamentos' },
    { icon: '❓', label: 'Ajuda e suporte', sub: 'Central 88 Mobility 24h' },
  ];

  const handleLogout = () => {
    Alert.alert('Sair do app?', 'Você será desconectado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{driver?.name?.charAt(0) ?? 'A'}</Text>
        </View>
        <Text style={styles.name}>{driver?.name || 'Abel Magalhães'}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>⭐ 5.0</Text>
          <Text style={styles.ratingDot}>·</Text>
          <Text style={styles.rides}>{totalRidesCount} {totalRidesCount === 1 ? 'corrida' : 'corridas'}</Text>
        </View>
        <Text style={styles.email}>{driver?.email || 'abel.souza.magalhaes@hotmail.com'}</Text>
      </View>

      {/* Stats Reais */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatBRL(totalEarningsMonth)}</Text>
          <Text style={styles.statLabel}>Ganhos Reais</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalRidesCount}</Text>
          <Text style={styles.statLabel}>Corridas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>5.0 ⭐</Text>
          <Text style={styles.statLabel}>Avaliação</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.sub}</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sair */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Desconectar da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>88 Mobility Motorista · Versão 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content:   { padding: Spacing.lg, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginVertical: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.amber,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.amber, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: Colors.dark },
  name:       { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rating:     { fontSize: 13, color: Colors.amber, fontWeight: '600' },
  ratingDot:  { color: Colors.slate500 },
  rides:      { fontSize: 13, color: Colors.slate400 },
  email:      { fontSize: 13, color: Colors.slate500 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.xl,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 18, fontWeight: '800', color: Colors.white },
  statLabel:   { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.darkBorder },

  menu: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkBorder,
  },
  menuIcon:  { fontSize: 20 },
  menuLabel: { fontSize: 14, fontWeight: '500', color: Colors.white },
  menuSub:   { fontSize: 12, color: Colors.slate400, marginTop: 1 },
  menuArrow: { fontSize: 18, color: Colors.slate500 },

  logoutBtn: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    backgroundColor: Colors.danger + '10',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoutText: { color: Colors.danger, fontWeight: '600', fontSize: 14 },

  version: { textAlign: 'center', color: Colors.slate600, fontSize: 12 },
});
