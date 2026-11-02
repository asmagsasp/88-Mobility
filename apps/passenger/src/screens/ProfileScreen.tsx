import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Switch, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const PASSENGER_HISTORY_KEY = '@88mobility_passenger_history';
const PASSENGER_NOTIF_KEY = '@88mobility_passenger_notifications';

export function ProfileScreen() {
  const { passenger, logout, updateProfile } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const [realRidesCount, setRealRidesCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Modal para editar Nome Completo e Telefone
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName]           = useState(passenger?.name || '');
  const [editPhone, setEditPhone]         = useState(passenger?.phone || '');
  const [isSaving, setIsSaving]           = useState(false);

  useEffect(() => {
    if (passenger) {
      setEditName(passenger.name || '');
      setEditPhone(passenger.phone || '');
    }
  }, [passenger]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PASSENGER_HISTORY_KEY);
        if (stored) {
          const list = JSON.parse(stored);
          setRealRidesCount(list.length);
        }
        const storedNotif = await AsyncStorage.getItem(PASSENGER_NOTIF_KEY);
        if (storedNotif !== null) {
          setNotificationsEnabled(JSON.parse(storedNotif));
        }
      } catch (e) {
        console.warn('Erro ao carregar histórico no perfil:', e);
      }
    })();
  }, []);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Atenção', 'Informe seu Nome Completo.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ name: editName.trim(), phone: editPhone.trim() });
      setShowEditModal(false);
      Alert.alert('Perfil Atualizado', 'Seu nome foi atualizado com sucesso para as viagens.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    try {
      await AsyncStorage.setItem(PASSENGER_NOTIF_KEY, JSON.stringify(val));
    } catch (e) {
      console.warn('Erro ao salvar notificações:', e);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair do app?', '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Avatar Header */}
      <View style={[styles.headerBg, { backgroundColor: isDark ? colors.cardSecondary : '#0F172A' }]}>
        <View style={[styles.avatar, { backgroundColor: colors.amber }]}>
          <Text style={styles.avatarText}>{passenger?.name?.charAt(0) ?? 'P'}</Text>
        </View>
        <Text style={styles.name}>{passenger?.name || 'Passageiro'}</Text>
        <Text style={styles.email}>{passenger?.email || ''}</Text>
        {passenger?.phone ? <Text style={styles.phoneText}>📞 {passenger.phone}</Text> : null}
        <Text style={styles.rides}>{realRidesCount} {realRidesCount === 1 ? 'corrida realizada' : 'corridas realizadas'}</Text>
      </View>

      <View style={styles.body}>
        {/* Bloco de Aparência (Modo Escuro / Claro) */}
        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: Spacing.md }]}>
          <View style={styles.themeToggleItem}>
            <View style={[styles.menuIconBg, { backgroundColor: colors.slate100 }]}>
              <Text style={styles.menuIcon}>{isDark ? '🌙' : '☀️'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Modo Escuro</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                {isDark ? 'Tema escuro ativado' : 'Tema claro ativado'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: colors.amberDark }}
              thumbColor={isDark ? colors.amber : '#F8FAFC'}
            />
          </View>
        </View>

        {/* Menu Geral */}
        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Editar Nome e Dados */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => setShowEditModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBg, { backgroundColor: colors.slate100 }]}>
              <Text style={styles.menuIcon}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Nome e Dados Pessoais</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                {passenger?.name || 'Editar nome exibido nas viagens'}
              </Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.slate400 }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: colors.slate100 }]}>
              <Text style={styles.menuIcon}>💳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Formas de pagamento</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Cartão, Pix, dinheiro</Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.slate400 }]}>›</Text>
          </TouchableOpacity>

          {/* Toggle de Notificações */}
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={[styles.menuIconBg, { backgroundColor: colors.slate100 }]}>
              <Text style={styles.menuIcon}>🔔</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Notificações</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                {notificationsEnabled ? '🟢 Alertas de corridas ativados' : '⚫ Notificações silenciadas'}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#CBD5E1', true: colors.amberDark }}
              thumbColor={notificationsEnabled ? colors.amber : '#F8FAFC'}
            />
          </View>

          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: colors.slate100 }]}>
              <Text style={styles.menuIcon}>❓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Ajuda e suporte</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Central de atendimento 88 Mobility</Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.slate400 }]}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: colors.danger }]}>Sair do app</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textMuted }]}>88 Mobility v1.0.0</Text>
      </View>

      {/* Modal Editar Perfil / Nome */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Dados do Passageiro</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Seu nome é exibido para o motorista durante a corrida (estilo Uber e 99).
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>Nome Completo</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ex: Maria Silva"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>Telefone / WhatsApp</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="(11) 98888-8888"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: colors.amber }]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.modalSaveText}>Salvar Nome</Text>
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
  container: { flex: 1 },
  content:   { flexGrow: 1 },

  headerBg: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, shadowColor: '#F59E0B', shadowOpacity: 0.4,
    shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#0F172A' },
  name:       { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  email:      { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  rides:      { fontSize: 12, color: '#CBD5E1', marginTop: 6 },

  body: { padding: Spacing.lg },
  menu: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  themeToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuIconBg: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIcon:  { fontSize: 18 },
  menuLabel: { fontSize: 14, fontWeight: '500' },
  menuSub:   { fontSize: 12, marginTop: 1 },
  menuArrow: { fontSize: 20 },

  logoutBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoutText: { fontWeight: '600', fontSize: 15 },
  version:    { textAlign: 'center', fontSize: 12 },
  phoneText:  { fontSize: 13, color: '#FCD34D', marginTop: 2, fontWeight: '600' },

  // Modal de edição de perfil
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  modalInputGroup: {
    marginBottom: Spacing.sm,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
