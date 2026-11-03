import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/theme';

const REMEMBER_KEY = '88mobility_passenger_remember';

/**
 * Tela de login e cadastro do passageiro com identificação por Nome Completo,
 * suporte aos temas Claro e Escuro e funcionalidade "Lembrar meus dados de acesso"
 */
export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { login, registerPassenger, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Campos de cadastro
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Campos comuns
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Carrega credenciais salvas na inicialização
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(REMEMBER_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.password) setPassword(parsed.password);
          if (parsed.name) setName(parsed.name);
          if (parsed.phone) setPhone(parsed.phone);
          setRememberMe(true);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados salvos do passageiro:', err);
      }
    })();
  }, []);

  const validatePassword = (pass: string) => {
    const hasMinLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    return hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  };

  const handleAction = async () => {
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      Alert.alert('Atenção', 'Preencha email e senha');
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('Email Inválido', 'Por favor insira um e-mail válido.');
      return;
    }

    if (!validatePassword(trimmedPass)) {
      Alert.alert(
        'Senha Fraca ou Inválida',
        'A senha deve conter ao menos:\n• 8 caracteres\n• 1 letra maiúscula\n• 1 letra minúscula\n• 1 número\n• 1 caractere especial (!@#$%^&*)'
      );
      return;
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        Alert.alert('Nome Obrigatório', 'Por favor informe seu Nome Completo para identificação na corrida.');
        return;
      }
      if (!phone.trim()) {
        Alert.alert('Telefone Obrigatório', 'Por favor informe seu telefone celular / WhatsApp.');
        return;
      }
    }

    // Salva ou remove credenciais com base na opção "Lembrar Senha"
    try {
      if (rememberMe) {
        await AsyncStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({
            email: trimmedEmail,
            password: trimmedPass,
            name: name.trim(),
            phone: phone.trim(),
          })
        );
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }
    } catch (e) {
      console.warn('Erro ao salvar no storage:', e);
    }

    try {
      if (isRegisterMode) {
        await registerPassenger({
          name: name.trim(),
          phone: phone.trim(),
          email: trimmedEmail,
          password: trimmedPass,
        });
      } else {
        await login(trimmedEmail, trimmedPass);
      }
      onLogin();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível realizar o acesso.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header com logo oficial */}
        <View style={[styles.header, { backgroundColor: isDark ? colors.cardSecondary : '#0F172A' }]}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>88 Mobility</Text>
          <Text style={styles.tagline}>Passageiro · Sua corrida com preço justo</Text>
        </View>

        {/* Abas Entrar / Cadastrar-se */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              !isRegisterMode && { backgroundColor: colors.amber },
            ]}
            onPress={() => setIsRegisterMode(false)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: !isRegisterMode ? '#0F172A' : colors.textSecondary },
                !isRegisterMode && { fontWeight: '700' },
              ]}
            >
              Entrar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              isRegisterMode && { backgroundColor: colors.amber },
            ]}
            onPress={() => setIsRegisterMode(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: isRegisterMode ? '#0F172A' : colors.textSecondary },
                isRegisterMode && { fontWeight: '700' },
              ]}
            >
              Cadastrar-se
            </Text>
          </TouchableOpacity>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {isRegisterMode ? 'Crie sua conta' : 'Bem-vindo de volta!'}
          </Text>
          <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
            {isRegisterMode
              ? 'Identifique-se com seu nome real para os motoristas'
              : 'Entre com seus dados para solicitar viagens'}
          </Text>

          {isRegisterMode && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Nome Completo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Maria Silva ou Abel Magalhães"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Telefone / WhatsApp</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhone(text))}
                  placeholder="(11) 98888-8888"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="off"
                  importantForAutofill="no"
                />
              </View>
            </>
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>E-mail</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Senha</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          {/* Opção Lembrar Senha */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.border },
                rememberMe && { backgroundColor: colors.amber, borderColor: colors.amber },
              ]}
            >
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.rememberText, { color: colors.textSecondary }]}>
              Lembrar meus dados de acesso
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.amber }, isLoading && styles.btnDisabled]}
            onPress={handleAction}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#0F172A" />
              : <Text style={styles.btnText}>{isRegisterMode ? 'Criar Conta de Passageiro 🚀' : 'Entrar'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => setIsRegisterMode(!isRegisterMode)}
          >
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>
              {isRegisterMode ? 'Já possui cadastro? ' : 'Não tem conta? '}
              <Text style={[styles.registerLink, { color: colors.amber }]}>
                {isRegisterMode ? 'Fazer login' : 'Cadastre-se com seu Nome'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 55,
    paddingBottom: 25,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoImage: {
    width: 76,
    height: 76,
    borderRadius: 18,
    marginBottom: 8,
  },
  appName:   { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  tagline:   { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: 16,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  formTitle:    { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  formSubtitle: { fontSize: 14, marginBottom: Spacing.md },
  fieldGroup:  { marginBottom: Spacing.sm },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: Spacing.sm,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15,
  },
  rememberText: {
    fontSize: 14,
    fontWeight: '500',
  },
  btn: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  registerBtn: { marginTop: Spacing.md, marginBottom: Spacing.xl, alignItems: 'center' },
  registerText: { fontSize: 14 },
  registerLink: { fontWeight: '700' },
});
