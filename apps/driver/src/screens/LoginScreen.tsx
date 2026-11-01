import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, Radius } from '../constants/theme';

const REMEMBER_KEY = '88mobility_driver_remember';

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { login, registerDriver, isLoginLoading, isAuthenticated } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Campos de cadastro
  const [name, setName]                 = useState('');
  const [phone, setPhone]               = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Campos de login
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [rememberMe, setRememberMe]     = useState(true);

  // Carrega credenciais salvas se houver
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
        console.warn('Erro ao carregar dados salvos:', err);
      }
    })();
  }, []);

  // Navega assim que o contexto confirmar autenticação
  useEffect(() => {
    if (isAuthenticated) onLogin();
  }, [isAuthenticated, onLogin]);

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
      Alert.alert('Campos Obrigatórios', 'Preencha o e-mail e a senha.');
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('Email Inválido', 'Insira um endereço de e-mail válido.');
      return;
    }

    if (!validatePassword(trimmedPass)) {
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

    if (isRegisterMode) {
      if (!name.trim() || !phone.trim() || !vehicleModel.trim() || !vehiclePlate.trim()) {
        Alert.alert('Dados Incompletos', 'Preencha todos os dados cadastrais e do veículo.');
        return;
      }
      registerDriver({
        name: name.trim(),
        email: trimmedEmail,
        phone: phone.trim(),
        vehicleModel: vehicleModel.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        password: trimmedPass,
      });
    } else {
      login(trimmedEmail, trimmedPass);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.glowTop} />

      {/* Logo Oficial 88 Mobility */}
      <View style={styles.logoWrapper}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>88 Mobility</Text>
        <Text style={styles.appRole}>Área do Motorista Parceiro</Text>
      </View>

      {/* Card Principal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {isRegisterMode ? 'Cadastrar Novo Motorista' : 'Entrar na Plataforma'}
        </Text>

        {isRegisterMode && (
          <>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome completo"
              placeholderTextColor={Colors.slate500}
              editable={!isLoginLoading}
              autoComplete="name"
              textContentType="name"
              importantForAutofill="yes"
            />

            <Text style={[styles.label, { marginTop: Spacing.sm }]}>Telefone / WhatsApp</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(11) 99999-9999"
              placeholderTextColor={Colors.slate500}
              keyboardType="phone-pad"
              editable={!isLoginLoading}
              autoComplete="tel"
              textContentType="telephoneNumber"
            />

            <Text style={[styles.label, { marginTop: Spacing.sm }]}>Modelo do Veículo</Text>
            <TextInput
              style={styles.input}
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="Ex: Honda Civic 2022"
              placeholderTextColor={Colors.slate500}
              editable={!isLoginLoading}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
            />

            <Text style={[styles.label, { marginTop: Spacing.sm }]}>Placa do Carro</Text>
            <TextInput
              style={styles.input}
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              placeholder="BRA2E19"
              placeholderTextColor={Colors.slate500}
              autoCapitalize="characters"
              editable={!isLoginLoading}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
            />
          </>
        )}

        {/* Email */}
        <Text style={[styles.label, isRegisterMode && { marginTop: Spacing.sm }]}>E-mail</Text>
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
          autoComplete="email"
          textContentType="emailAddress"
          importantForAutofill="yes"
        />

        {/* Senha */}
        <Text style={[styles.label, { marginTop: Spacing.sm }]}>Senha</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor={Colors.slate500}
          secureTextEntry
          editable={!isLoginLoading}
          autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
          textContentType={isRegisterMode ? 'newPassword' : 'password'}
        />

        {/* Opção Lembrar Senha */}
        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Lembrar meus dados de acesso</Text>
        </TouchableOpacity>

        {/* Botão de Ação */}
        <TouchableOpacity
          style={[styles.btn, isLoginLoading && styles.btnDisabled]}
          onPress={handleAction}
          disabled={isLoginLoading}
          activeOpacity={0.85}
        >
          {isLoginLoading ? (
            <ActivityIndicator color={Colors.dark} />
          ) : (
            <Text style={styles.btnText}>
              {isRegisterMode ? 'Concluir Cadastro' : 'Entrar'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Alternância entre Login e Cadastro */}
        <TouchableOpacity
          style={styles.toggleModeBtn}
          onPress={() => setIsRegisterMode(!isRegisterMode)}
          disabled={isLoginLoading}
        >
          <Text style={styles.toggleModeText}>
            {isRegisterMode
              ? 'Já possui cadastro? '
              : 'Novo motorista? '}
            <Text style={styles.toggleModeLink}>
              {isRegisterMode ? 'Entrar' : 'Cadastre-se aqui'}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>88 Mobility · 88% do valor para você</Text>
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
  logoWrapper: { alignItems: 'center', marginBottom: 24 },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: Radius.xl,
    marginBottom: Spacing.sm,
  },
  appName:   { fontSize: 24, fontWeight: '800', color: Colors.white },
  appRole:   { fontSize: 13, color: Colors.slate400, marginTop: 2 },

  card: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: Spacing.md },

  label: { fontSize: 13, fontWeight: '600', color: Colors.slate400, marginBottom: 4 },
  input: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.slate500,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: Colors.dark,
  },
  checkboxActive: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  checkmark: {
    color: Colors.dark,
    fontSize: 13,
    fontWeight: '900',
  },
  rememberText: {
    color: Colors.slate200,
    fontSize: 13,
  },

  btn: {
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: Colors.dark, fontSize: 16, fontWeight: '700' },

  toggleModeBtn: { marginTop: Spacing.md, alignItems: 'center', paddingVertical: 4 },
  toggleModeText: { color: Colors.slate400, fontSize: 13 },
  toggleModeLink: { color: Colors.amber, fontWeight: '700' },

  footer: { textAlign: 'center', color: Colors.slate500, fontSize: 12, marginTop: 24 },
});
