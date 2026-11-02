import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/theme';

const REMEMBER_KEY = '88mobility_passenger_remember';

/**
 * Tela de login do passageiro com suporte aos temas Claro e Escuro
 * e funcionalidade "Lembrar meus dados de acesso"
 */
export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { login, isLoading } = useAuth();
  const { colors, isDark } = useTheme();
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
          setRememberMe(true);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados salvos do passageiro:', err);
      }
    })();
  }, []);

  const handleLogin = async () => {
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

    // Regra estrita de senha: mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial
    const hasMinLength = trimmedPass.length >= 8;
    const hasUpper = /[A-Z]/.test(trimmedPass);
    const hasLower = /[a-z]/.test(trimmedPass);
    const hasNumber = /[0-9]/.test(trimmedPass);
    const hasSpecial = /[^A-Za-z0-9]/.test(trimmedPass);

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      Alert.alert(
        'Senha Fraca ou Inválida',
        'A senha deve conter ao menos:\n• 8 caracteres\n• 1 letra maiúscula\n• 1 letra minúscula\n• 1 número\n• 1 caractere especial (!@#$%^&*)'
      );
      return;
    }

    // Salva ou remove credenciais com base na opção "Lembrar Senha"
    try {
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: trimmedEmail, password: trimmedPass }));
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }
    } catch (e) {
      console.warn('Erro ao salvar no storage:', e);
    }

    try {
      await login(trimmedEmail, trimmedPass);
      onLogin();
    } catch {
      Alert.alert('Erro', 'Não foi possível fazer login');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header com logo oficial */}
        <View style={[styles.header, { backgroundColor: isDark ? colors.cardSecondary : '#0F172A' }]}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>88 Mobility</Text>
          <Text style={styles.tagline}>Sua corrida, seu preço justo</Text>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Bem-vindo de volta!</Text>
          <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Entre para solicitar sua corrida</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
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
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#0F172A" />
              : <Text style={styles.btnText}>Entrar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerBtn}>
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>
              Não tem conta? <Text style={[styles.registerLink, { color: colors.amber }]}>Cadastre-se</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1 },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 12,
  },
  appName:   { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  tagline:   { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  form: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  formTitle:    { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  formSubtitle: { fontSize: 14, marginBottom: Spacing.lg },
  fieldGroup:  { marginBottom: Spacing.md },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
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
    paddingVertical: 15,
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
  registerBtn: { marginTop: Spacing.lg, alignItems: 'center' },
  registerText: { fontSize: 14 },
  registerLink: { fontWeight: '700' },
});
