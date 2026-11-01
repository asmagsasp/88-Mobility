import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import type { CompletedDriverRide } from './EarningsScreen';

const STORAGE_KEY = '@88mobility_driver_completed_rides';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProfileScreen() {
  const { driver, logout, updateDriverProfile } = useAuth();
  const [completedRides, setCompletedRides] = useState<CompletedDriverRide[]>([]);

  // Modos de edição inline (100% nativo e livre de bugs de Modal no Android)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState(driver?.name || '');
  const [editModel, setEditModel] = useState(driver?.vehicle || '');
  const [editPlate, setEditPlate] = useState(driver?.vehiclePlate || '');
  const [isSaving, setIsSaving]   = useState(false);

  // Sincroniza campos quando o motorista é carregado
  useEffect(() => {
    if (driver) {
      setEditName(driver.name || '');
      setEditModel(driver.vehicle || '');
      setEditPlate(driver.vehiclePlate || '');
    }
  }, [driver]);

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

  const handleStartEditing = () => {
    setEditName(driver?.name || '');
    setEditModel(driver?.vehicle || '');
    setEditPlate(driver?.vehiclePlate || '');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditName(driver?.name || '');
    setEditModel(driver?.vehicle || '');
    setEditPlate(driver?.vehiclePlate || '');
    setIsEditing(false);
  };

  const handleSaveVehicle = async () => {
    const trimmedModel = editModel.trim();
    const trimmedPlate = editPlate.trim().toUpperCase();
    const trimmedName  = editName.trim();

    if (!trimmedModel || !trimmedPlate) {
      Alert.alert('Campos Obrigatórios', 'Preencha o modelo do carro e a placa.');
      return;
    }

    setIsSaving(true);
    try {
      await updateDriverProfile({
        name: trimmedName || driver?.name || 'Motorista Parceiro',
        vehicle: trimmedModel,
        vehiclePlate: trimmedPlate,
      });
      setIsEditing(false);
      Alert.alert('Sucesso! 🎉', 'Modelo do veículo e placa atualizados com sucesso.');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar os dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair do app?', 'Você será desconectado da sua conta.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Avatar e Dados Principais */}
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

      {/* Card de Gestão e Edição Direta do Veículo */}
      <View style={styles.vehicleCard}>
        <View style={styles.vehicleCardHeader}>
          <Text style={styles.vehicleCardTitle}>🚗 Meu Veículo & Dados</Text>
          {!isEditing && (
            <TouchableOpacity style={styles.editPillBtn} onPress={handleStartEditing} activeOpacity={0.7}>
              <Text style={styles.editPillBtnText}>✏️ Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={styles.editForm}>
            <Text style={styles.editHint}>
              Estes dados são enviados ao passageiro quando você aceita uma corrida:
            </Text>

            <Text style={styles.inputLabel}>Modelo do Veículo</Text>
            <TextInput
              style={styles.input}
              value={editModel}
              onChangeText={setEditModel}
              placeholder="Ex: Fiat Argo 2022, Honda Civic..."
              placeholderTextColor={Colors.slate500}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Placa do Carro</Text>
            <TextInput
              style={styles.input}
              value={editPlate}
              onChangeText={setEditPlate}
              placeholder="Ex: ABC1D23 ou BRA2E19"
              placeholderTextColor={Colors.slate500}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Nome do Motorista</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Seu nome completo"
              placeholderTextColor={Colors.slate500}
              autoCapitalize="words"
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelEditing}
                disabled={isSaving}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveVehicle}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.dark} />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Dados</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.vehicleInfoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Modelo:</Text>
              <Text style={styles.infoValue}>{currentVehicle}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Placa:</Text>
              <Text style={[styles.infoValue, { color: Colors.amber }]}>{currentPlate}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Motorista:</Text>
              <Text style={styles.infoValue}>{driver?.name || 'Motorista'}</Text>
            </View>
          </View>
        )}
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

      {/* Outras Opções de Menu */}
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('Documentos', 'Seus documentos (CNH e CRLV) foram verificados com sucesso.')}>
          <Text style={styles.menuIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Documentos</Text>
            <Text style={styles.menuSub}>CNH e CRLV validados</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('Dados Bancários', 'Chave PIX ativa para repasse imediato de 88%.')}>
          <Text style={styles.menuIcon}>💳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Dados bancários</Text>
            <Text style={styles.menuSub}>Chave PIX cadastrada para repasse</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('Notificações', 'Notificações sonoras e visuais de corridas ativas.')}>
          <Text style={styles.menuIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Notificações</Text>
            <Text style={styles.menuSub}>Avisos sonoros de novas corridas</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('Suporte 88 Mobility', 'Atendimento oficial ao motorista parceiro 24h.')}>
          <Text style={styles.menuIcon}>❓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Ajuda e suporte</Text>
            <Text style={styles.menuSub}>Central 88 Mobility 24h</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
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
  avatarText:    { fontSize: 32, fontWeight: '800', color: Colors.dark },
  name:          { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  vehicleHeader: { fontSize: 14, fontWeight: '700', color: Colors.amber, marginBottom: 6 },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rating:        { fontSize: 13, color: Colors.amber, fontWeight: '600' },
  ratingDot:     { color: Colors.slate500 },
  rides:         { fontSize: 13, color: Colors.slate400 },
  email:         { fontSize: 13, color: Colors.slate500 },

  // Card do Veículo
  vehicleCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.lg,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  vehicleCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.white },
  editPillBtn: {
    backgroundColor: Colors.amber,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  editPillBtnText: { color: Colors.dark, fontWeight: '700', fontSize: 12 },

  vehicleInfoList: { marginTop: 4 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel:   { fontSize: 13, color: Colors.slate400 },
  infoValue:   { fontSize: 14, fontWeight: '600', color: Colors.white },
  infoDivider: { height: 1, backgroundColor: Colors.darkBorder, marginVertical: 2 },

  // Formulário de Edição
  editForm: { marginTop: Spacing.sm },
  editHint: { fontSize: 12, color: Colors.slate400, marginBottom: Spacing.md, lineHeight: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.slate200, marginBottom: 4 },
  input: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.white,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  cancelBtnText: { color: Colors.slate400, fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.amber,
    alignItems: 'center',
  },
  saveBtnText: { color: Colors.dark, fontWeight: '800', fontSize: 14 },

  // Stats
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
  statValue:   { fontSize: 18, fontWeight: '800', color: Colors.white },
  statLabel:   { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.darkBorder },

  // Menu
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
});
