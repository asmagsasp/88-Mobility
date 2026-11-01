import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export function ProfileScreen() {
  const { driver, logout } = useAuth();

  const menuItems = [
    { icon: '🚗', label: 'Meu veículo', sub: `${driver?.vehicle ?? 'Toyota Corolla 2023'} · ${driver?.vehiclePlate ?? 'BRA-8888'}` },
    { icon: '📋', label: 'Documentos', sub: 'CNH, CRLV, antecedentes' },
    { icon: '💳', label: 'Dados bancários', sub: 'Para receber seus ganhos' },
    { icon: '🔔', label: 'Notificações', sub: 'Avisos de corridas e pagamentos' },
    { icon: '❓', label: 'Ajuda e suporte', sub: 'Central de atendimento' },
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
          <Text style={styles.avatarText}>{driver?.name?.charAt(0) ?? 'M'}</Text>
        </View>
        <Text style={styles.name}>{driver?.name}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>⭐ {driver?.rating?.toFixed(1)}</Text>
          <Text style={styles.ratingDot}>·</Text>
          <Text style={styles.rides}>{driver?.totalRides} corridas</Text>
        </View>
        <Text style={styles.email}>{driver?.email}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>R$ 1.680</Text>
          <Text style={styles.statLabel}>Este mês</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{driver?.totalRides}</Text>
          <Text style={styles.statLabel}>Corridas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>4.8 ⭐</Text>
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

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair do app</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content:   { padding: Spacing.lg, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, shadowColor: Colors.amber, shadowOpacity: 0.3,
    shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: Colors.dark },
  name:       { fontSize: 22, fontWeight: '700', color: Colors.white },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rating:     { fontSize: 14, color: Colors.amber, fontWeight: '600' },
  ratingDot:  { color: Colors.slate500 },
  rides:      { fontSize: 14, color: Colors.slate400 },
  email:      { fontSize: 13, color: Colors.slate500, marginTop: 4 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.lg,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 16, fontWeight: '700', color: Colors.white },
  statLabel:   { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.darkBorder },

  menu: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkBorder,
  },
  menuIcon:  { fontSize: 22 },
  menuLabel: { fontSize: 14, fontWeight: '500', color: Colors.white },
  menuSub:   { fontSize: 12, color: Colors.slate500, marginTop: 1 },
  menuArrow: { fontSize: 20, color: Colors.slate600 },

  logoutBtn: {
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.danger + '10',
  },
  logoutText: { color: Colors.danger, fontWeight: '600', fontSize: 15 },
});
