import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import type { CompletedDriverRide } from './EarningsScreen';

const STORAGE_KEY = '@88mobility_driver_completed_rides';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProfileScreen() {
  const { driver, logout, updateVehicle } = useAuth();
  const [completedRides, setCompletedRides] = useState<CompletedDriverRide[]>([]);

  // Estados de edição do veículo
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [editModel, setEditModel]               = useState('');
  const [editPlate, setEditPlate]               = useState('');
  const [isSaving, setIsSaving]                 = useState(false);

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

  const currentVehicle = driver?.vehicle || 'Carro Cadastrado';
  const currentPlate   = driver?.vehiclePlate || 'Sem Placa';

  const openVehicleModal = () => {
    setEditModel(driver?.vehicle || '');
    setEditPlate(driver?.vehiclePlate || '');
    setIsEditingVehicle(true);
  };

  const handleSaveVehicle = async () => {
    if (!editModel.trim() || !editPlate.trim()) {
      Alert.alert('Campos Obrigatórios', 'Preencha o modelo do carro e a placa.');
      return;
    }
    setIsSaving(true);
    await updateVehicle(editModel.trim(), editPlate.trim().toUpperCase());
    setIsSaving(false);
    setIsEditingVehicle(false);
    Alert.alert('Sucesso', 'Dados do veículo atualizados com sucesso!');
  };

  const menuItems = [
    {
      icon: '🚗',
      label: 'Meu veículo',
      sub: `${currentVehicle} · ${currentPlate} (toque para editar)`,
      onPress: openVehicleModal,
    },
    { icon: '📋', label: 'Documentos', sub: 'CNH, CRLV validados', onPress: () => Alert.alert('Documentos', 'Seus documentos estão aprovados.') },
    { icon: '💳', label: 'Dados bancários', sub: 'Chave PIX cadastrada para repasse', onPress: () => Alert.alert('Dados Bancários', 'Chave PIX ativa para repasse imediato.') },
    { icon: '🔔', label: 'Notificações', sub: 'Avisos de novas corridas ativados', onPress: () => Alert.alert('Notificações', 'Notificações sonoras e visuais ativas.') },
    { icon: '❓', label: 'Ajuda e suporte', sub: 'Central 88 Mobility 24h', onPress: () => Alert.alert('Suporte 88 Mobility', 'Atendimento de suporte ao motorista disponível 24h.') },
  ];

  const handleLogout = () => {
    Alert.alert('Sair do app?', 'Você será desconectado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar e Dados do Motorista */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{driver?.name?.charAt(0) ?? 'A'}</Text>
        </View>
        <Text style={styles.name}>{driver?.name || 'Motorista Parceiro'}</Text>
        <Text style={styles.vehicleHeader}>🚗 {currentVehicle} · {currentPlate}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>⭐ 5.0</Text>
          <Text style={styles.ratingDot}>·</Text>
          <Text style={styles.rides}>{totalRidesCount} {totalRidesCount === 1 ? 'corrida' : 'corridas'}</Text>
        </View>
        <Text style={styles.email}>{driver?.email || ''}</Text>
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

      {/* Menu com clique para editar veículo */}
      <View style={styles.menu}>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={item.onPress}
          >
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

      {/* Modal para Editar Veículo e Placa */}
      <Modal
        visible={isEditingVehicle}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingVehicle(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Dados do Veículo</Text>
            <Text style={styles.modalSubtitle}>
              Estes dados aparecem para o passageiro ao solicitar a corrida.
            </Text>

            <Text style={styles.inputLabel}>Modelo do Veículo</Text>
            <TextInput
              style={styles.input}
              value={editModel}
              onChangeText={setEditModel}
              placeholder="Ex: Fiat Argo 2022, Honda Civic..."
              placeholderTextColor={Colors.slate500}
            />

            <Text style={styles.inputLabel}>Placa do Carro</Text>
            <TextInput
              style={styles.input}
              value={editPlate}
              onChangeText={setEditPlate}
              placeholder="Ex: BRA2E19 ou ABC-1234"
              placeholderTextColor={Colors.slate500}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsEditingVehicle(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelModalText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleSaveVehicle}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.dark} />
                ) : (
                  <Text style={styles.saveModalText}>Salvar Veículo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  avatarText:    { fontSize: 32, fontWeight: '800', color: Colors.dark },
  name:          { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  vehicleHeader: { fontSize: 14, fontWeight: '600', color: Colors.amber, marginBottom: 6 },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rating:        { fontSize: 13, color: Colors.amber, fontWeight: '600' },
  ratingDot:     { color: Colors.slate500 },
  rides:         { fontSize: 13, color: Colors.slate400 },
  email:         { fontSize: 13, color: Colors.slate500 },

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
  version:    { textAlign: 'center', color: Colors.slate600, fontSize: 12 },

  // Modal de edição
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: Colors.slate400, marginBottom: Spacing.lg },
  inputLabel:    { fontSize: 13, fontWeight: '600', color: Colors.slate200, marginBottom: 6 },
  input: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.white,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  modalActions:   { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  cancelModalText: { color: Colors.slate400, fontWeight: '600' },
  saveModalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.amber,
    alignItems: 'center',
  },
  saveModalText: { color: Colors.dark, fontWeight: '800' },
});
