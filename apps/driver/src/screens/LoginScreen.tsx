import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, Radius } from '../constants/theme';

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { login, isLoginLoading, isAuthenticated } = useAuth();
  const [email, setEmail]       = useState('motorista@88mobility.com');
  const [password, setPassword] = useState('Driver88#2026');

  // Navega assim que o contexto confirmar autenticação
  React.useEffect(() => {
    if (isAuthenticated) onLogin();
  }, [isAuthenticated]);

  const handleLogin = () => {
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

    login(trimmedEmail, trimmedPass);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Glow decorativo */}
      <View style={styles.glowTop} />

      {/* Logo */}
      <View style={styles.logoWrapper}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>88 Mobility</Text>
        <Text style={styles.appRole}>Área do Motorista</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Entrar</Text>

        {/* DEV hint */}
        <View style={styles.devHint}>
          <Text style={styles.devHintText}>DEV · Qualquer email/senha funciona</Text>
        </View>

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          placeholderTextColor={Colors.slate500}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoginLoading}
        />

        {/* Senha */}
        <Text style={[styles.label, { marginTop: Spacing.md }]}>Senha</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••"
          placeholderTextColor={Colors.slate500}
          secureTextEntry
          editable={!isLoginLoading}
        />

        {/* Botão */}
        <TouchableOpacity
          style={[styles.btn, isLoginLoading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={isLoginLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {isLoginLoading ? 'Entrando...' : 'Entrar'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>88 Mobility © 2024</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 40,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.amber,
    opacity: 0.06,
  },
  logoWrapper: { alignItems: 'center', marginBottom: 32 },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
  },
  appName:   { fontSize: 22, fontWeight: '700', color: Colors.white },
  appRole:   { fontSize: 13, color: Colors.slate400, marginTop: 2 },

  card: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: Spacing.md },

  devHint: {
    backgroundColor: `${Colors.amber}18`,
    borderWidth: 1,
    borderColor: `${Colors.amber}40`,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: Spacing.md,
  },
  devHintText: { fontSize: 12, color: Colors.amber, fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', color: Colors.slate400, marginBottom: 6 },
  input: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.white,
  },

  btn: {
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: Colors.dark, fontSize: 16, fontWeight: '700' },

  footer: {
    textAlign: 'center',
    color: Colors.slate500,
    fontSize: 12,
    marginTop: 32,
  },
});
