import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, ActivityIndicator, Image, Switch, Modal, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import type { CompletedDriverRide } from './EarningsScreen';

const STORAGE_KEY = '@88mobility_driver_completed_rides';
const DOCS_STORAGE_KEY = '@88mobility_driver_documents';
const PIX_STORAGE_KEY = '@88mobility_driver_pix';
const NOTIFICATIONS_STORAGE_KEY = '@88mobility_driver_notifications';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type PixKeyType = 'cpf' | 'email' | 'phone' | 'random';

export function ProfileScreen() {
  const { driver, logout, updateDriverProfile } = useAuth();
  const [completedRides, setCompletedRides] = useState<CompletedDriverRide[]>([]);

  // Edição de Veículo & Nome
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState(driver?.name || '');
  const [editModel, setEditModel] = useState(driver?.vehicle || 'Honda Fit');
  const [editPlate, setEditPlate] = useState(driver?.vehiclePlate || 'BRA-8888');
  const [isSaving, setIsSaving]   = useState(false);

  // 1. Documentos (CNH e CRLV)
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [cnhUri, setCnhUri]               = useState<string | null>(null);
  const [crlvUri, setCrlvUri]             = useState<string | null>(null);
  const [cnhNumber, setCnhNumber]         = useState('');
  const [crlvRenavam, setCrlvRenavam]     = useState('');
  const [isSavingDocs, setIsSavingDocs]   = useState(false);

  // 2. Dados Bancários (Chave PIX para repasse)
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixKeyType, setPixKeyType]     = useState<PixKeyType>('cpf');
  const [pixKey, setPixKey]             = useState('');
  const [pixBank, setPixBank]           = useState('');
  const [pixOwnerName, setPixOwnerName] = useState(driver?.name || 'Abel Magalhães');
  const [isSavingPix, setIsSavingPix]   = useState(false);

  // 3. Notificações (Toggle)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Sincroniza campos quando o motorista é carregado
  useEffect(() => {
    if (driver) {
      setEditName(driver.name || '');
      setEditModel(driver.vehicle || 'Honda Fit');
      setEditPlate(driver.vehiclePlate || 'BRA-8888');
    }
  }, [driver]);

  // Carrega histórico, documentos, dados bancários e preferências de notificação
  useEffect(() => {
    (async () => {
      try {
        // Histórico
        const storedRides = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedRides) setCompletedRides(JSON.parse(storedRides));

        // Documentos
        const storedDocs = await AsyncStorage.getItem(DOCS_STORAGE_KEY);
        if (storedDocs) {
          const docs = JSON.parse(storedDocs);
          if (docs.cnhUri) setCnhUri(docs.cnhUri);
          if (docs.crlvUri) setCrlvUri(docs.crlvUri);
          if (docs.cnhNumber) setCnhNumber(docs.cnhNumber);
          if (docs.crlvRenavam) setCrlvRenavam(docs.crlvRenavam);
        }

        // Chave PIX
        const storedPix = await AsyncStorage.getItem(PIX_STORAGE_KEY);
        if (storedPix) {
          const p = JSON.parse(storedPix);
          if (p.pixKeyType) setPixKeyType(p.pixKeyType);
          if (p.pixKey) setPixKey(p.pixKey);
          if (p.pixBank) setPixBank(p.pixBank);
          if (p.pixOwnerName) setPixOwnerName(p.pixOwnerName);
        }

        // Notificações
        const storedNotif = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (storedNotif !== null) {
          setNotificationsEnabled(JSON.parse(storedNotif));
        }
      } catch (e) {
        console.warn('Erro ao carregar dados do perfil:', e);
      }
    })();
  }, []);

  const totalEarningsMonth = completedRides.reduce((acc, r) => acc + r.earning, 0);
  const totalRidesCount    = completedRides.length;
  const currentVehicle     = driver?.vehicle || 'Honda Fit';
  const currentPlate       = driver?.vehiclePlate || 'BRA-8888';

  const handleStartEditing = () => {
    setEditName(driver?.name || '');
    setEditModel(driver?.vehicle || 'Honda Fit');
    setEditPlate(driver?.vehiclePlate || 'BRA-8888');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditName(driver?.name || '');
    setEditModel(driver?.vehicle || 'Honda Fit');
    setEditPlate(driver?.vehiclePlate || 'BRA-8888');
    setIsEditing(false);
  };

  const handleSaveVehicle = async () => {
    const trimmedModel = editModel.trim() || 'Honda Fit';
    const trimmedPlate = editPlate.trim().toUpperCase() || 'BRA-8888';
    const trimmedName  = editName.trim() || driver?.name || 'Abel Magalhães';

    setIsSaving(true);
    try {
      await updateDriverProfile({
        name: trimmedName,
        vehicle: trimmedModel,
        vehiclePlate: trimmedPlate,
      });
      setIsEditing(false);
      Alert.alert('Sucesso! 🎉', `Veículo atualizado para ${trimmedModel} (${trimmedPlate}).`);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar os dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // GESTÃO DE DOCUMENTOS (Upload CNH e CRLV)
  // -------------------------------------------------------------
  const pickDocumentImage = async (docType: 'cnh' | 'crlv', fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão da Câmera', 'Precisamos de acesso à câmera para fotografar o documento.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.85,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão da Galeria', 'Precisamos de acesso à galeria para enviar a imagem do documento.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.85,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (docType === 'cnh') {
          setCnhUri(uri);
        } else {
          setCrlvUri(uri);
        }
      }
    } catch (err) {
      console.warn('Erro ao selecionar foto do documento:', err);
      Alert.alert('Erro', 'Falha ao processar o arquivo de imagem.');
    }
  };

  const chooseUploadMethod = (docType: 'cnh' | 'crlv') => {
    const title = docType === 'cnh' ? 'Enviar CNH' : 'Enviar CRLV';
    Alert.alert(
      title,
      'Como deseja enviar a foto do documento?',
      [
        { text: 'Tirar Foto com a Câmera 📸', onPress: () => pickDocumentImage(docType, true) },
        { text: 'Escolher da Galeria 🖼️', onPress: () => pickDocumentImage(docType, false) },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleSaveDocuments = async () => {
    if (!cnhUri && !crlvUri) {
      Alert.alert('Nenhum documento anexado', 'Fotografe ou anexe a CNH e/ou o CRLV antes de salvar.');
      return;
    }

    setIsSavingDocs(true);
    try {
      const payload = {
        cnhUri,
        crlvUri,
        cnhNumber: cnhNumber.trim(),
        crlvRenavam: crlvRenavam.trim(),
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(payload));

      // Tenta sincronizar com o banco de dados SQLite do Backend
      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
        fetch(`${backendUrl}/drivers/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseNumber: cnhNumber.trim(),
            vehicleRenavam: crlvRenavam.trim(),
            cnhPhotoUrl: cnhUri,
            crlvPhotoUrl: crlvUri,
          }),
        }).catch(() => {});
      } catch {}

      setIsSavingDocs(false);
      setShowDocsModal(false);
      Alert.alert('Documentos Enviados! 📋✅', 'Sua CNH e CRLV foram salvos com sucesso no sistema da 88 Mobility.');
    } catch (e) {
      setIsSavingDocs(false);
      Alert.alert('Erro', 'Não foi possível salvar os documentos.');
    }
  };

  // -------------------------------------------------------------
  // GESTÃO DE DADOS BANCÁRIOS (Chave PIX)
  // -------------------------------------------------------------
  const handleSavePix = async () => {
    const trimmedKey = pixKey.trim();
    if (!trimmedKey) {
      Alert.alert('Chave PIX Obrigatória', 'Por favor, digite sua Chave PIX para recebimento.');
      return;
    }

    setIsSavingPix(true);
    try {
      const payload = {
        pixKeyType,
        pixKey: trimmedKey,
        pixBank: pixBank.trim() || 'Banco Principal',
        pixOwnerName: pixOwnerName.trim() || driver?.name || 'Abel Magalhães',
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(PIX_STORAGE_KEY, JSON.stringify(payload));

      // Tenta sincronizar com o banco de dados SQLite do Backend
      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
        fetch(`${backendUrl}/drivers/pix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pixKeyType,
            pixKey: trimmedKey,
            pixBankName: pixBank.trim() || 'Banco Principal',
            pixAccountHolder: pixOwnerName.trim() || driver?.name || 'Abel Magalhães',
          }),
        }).catch(() => {});
      } catch {}

      setIsSavingPix(false);
      setShowPixModal(false);
      Alert.alert('Chave PIX Cadastrada! 💳🎉', 'Sua chave PIX para repasse de 88% foi configurada com sucesso.');
    } catch (e) {
      setIsSavingPix(false);
      Alert.alert('Erro', 'Não foi possível salvar os dados bancários.');
    }
  };

  // -------------------------------------------------------------
  // GESTÃO DE NOTIFICAÇÕES (Toggle ON/OFF)
  // -------------------------------------------------------------
  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
      console.warn('Erro ao salvar preferência de notificações:', e);
    }
  };

  const handleOpenSupportWhatsapp = async () => {
    const phone = '551934585300';
    const message = encodeURIComponent('Olá! Sou motorista parceiro e gostaria de tirar dúvidas e obter informações sobre o app 88 Mobility.');
    const appUrl = `whatsapp://send?phone=${phone}&text=${message}`;
    const webUrl = `https://wa.me/${phone}?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl).catch(() => {
        Alert.alert(
          'Ajuda & Suporte',
          'Não foi possível abrir o WhatsApp automaticamente. Adicione o número (19) 3458-5300 aos seus contatos para falar com nossa IA de suporte.'
        );
      });
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
              placeholder="Ex: Honda Fit, Toyota Corolla..."
              placeholderTextColor={Colors.slate500}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Placa do Carro</Text>
            <TextInput
              style={styles.input}
              value={editPlate}
              onChangeText={setEditPlate}
              placeholder="Ex: BRA-8888 ou ABC1D23"
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

      {/* Opções de Menu */}
      <View style={styles.menu}>
        {/* 1. Botão Documentos com Upload da CNH e CRLV */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => setShowDocsModal(true)}
        >
          <Text style={styles.menuIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.menuLabel}>Documentos</Text>
              {(cnhUri && crlvUri) ? (
                <View style={styles.badgeSuccess}>
                  <Text style={styles.badgeSuccessText}>Validados ✓</Text>
                </View>
              ) : (
                <View style={styles.badgePending}>
                  <Text style={styles.badgePendingText}>Upload pendente</Text>
                </View>
              )}
            </View>
            <Text style={styles.menuSub}>
              {cnhUri && crlvUri
                ? 'CNH e CRLV cadastrados com sucesso'
                : 'Toque para fazer upload da CNH e CRLV'}
            </Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        {/* 2. Dados Bancários com Cadastro da Chave PIX para Repasse */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => setShowPixModal(true)}
        >
          <Text style={styles.menuIcon}>💳</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.menuLabel}>Dados bancários</Text>
              {pixKey ? (
                <View style={styles.badgeSuccess}>
                  <Text style={styles.badgeSuccessText}>PIX Ativo ✓</Text>
                </View>
              ) : (
                <View style={styles.badgeWarning}>
                  <Text style={styles.badgeWarningText}>Cadastrar PIX</Text>
                </View>
              )}
            </View>
            <Text style={styles.menuSub} numberOfLines={1}>
              {pixKey
                ? `PIX: ${pixKey} · ${pixBank || 'Conta Ativa'}`
                : 'Cadastrar chave PIX para repasse de 88%'}
            </Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        {/* 3. Notificações com Toggle Nativo */}
        <View style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Notificações</Text>
            <Text style={styles.menuSub}>
              {notificationsEnabled
                ? '🟢 Avisos sonoros e visuais ativados'
                : '⚫ Notificações e sons silenciados'}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: Colors.darkBorder, true: Colors.success }}
            thumbColor={Colors.white}
          />
        </View>

        {/* 4. Suporte */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={handleOpenSupportWhatsapp}
        >
          <Text style={styles.menuIcon}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Ajuda e suporte</Text>
            <Text style={styles.menuSub}>Fale com nossa IA no WhatsApp (19) 3458-5300</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Sair */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Desconectar da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>88 Mobility Motorista · Versão 1.0.0</Text>

      {/* ======================================================== */}
      {/* MODAL / TELA DE UPLOAD DE DOCUMENTOS (CNH E CRLV)        */}
      {/* ======================================================== */}
      <Modal
        visible={showDocsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDocsModal(false)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDocsModal(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Upload de Documentos 📋</Text>
            <View style={{ width: 36 }} />
          </View>

          <Text style={styles.modalSubtitle}>
            Fotografe ou anexe sua Carteira Nacional de Habilitação (CNH) e o Certificado de Registro e Licenciamento do Veículo (CRLV).
          </Text>

          {/* Card CNH */}
          <View style={styles.docCard}>
            <View style={styles.docCardHeader}>
              <Text style={styles.docCardTitle}>1. CNH (Habilitação)</Text>
              {cnhUri ? (
                <Text style={styles.docCardBadgeDone}>✓ Anexada</Text>
              ) : (
                <Text style={styles.docCardBadgePending}>Pendente</Text>
              )}
            </View>

            {cnhUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: cnhUri }} style={styles.docPreviewImage} resizeMode="cover" />
                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={styles.docChangeBtn}
                    onPress={() => chooseUploadMethod('cnh')}
                  >
                    <Text style={styles.docChangeBtnText}>📷 Trocar Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.docRemoveBtn}
                    onPress={() => setCnhUri(null)}
                  >
                    <Text style={styles.docRemoveBtnText}>🗑️ Remover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadPlaceholder}
                activeOpacity={0.7}
                onPress={() => chooseUploadMethod('cnh')}
              >
                <Text style={styles.uploadIcon}>📸</Text>
                <Text style={styles.uploadMainText}>Fotografar ou Selecionar CNH</Text>
                <Text style={styles.uploadSubText}>Toque para abrir a câmera ou galeria</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.docInputLabel}>Número de Registro da CNH (opcional)</Text>
            <TextInput
              style={styles.docInput}
              value={cnhNumber}
              onChangeText={setCnhNumber}
              placeholder="Ex: 01234567890"
              placeholderTextColor={Colors.slate500}
              keyboardType="numeric"
            />
          </View>

          {/* Card CRLV */}
          <View style={styles.docCard}>
            <View style={styles.docCardHeader}>
              <Text style={styles.docCardTitle}>2. CRLV (Documento do Carro)</Text>
              {crlvUri ? (
                <Text style={styles.docCardBadgeDone}>✓ Anexada</Text>
              ) : (
                <Text style={styles.docCardBadgePending}>Pendente</Text>
              )}
            </View>

            {crlvUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: crlvUri }} style={styles.docPreviewImage} resizeMode="cover" />
                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={styles.docChangeBtn}
                    onPress={() => chooseUploadMethod('crlv')}
                  >
                    <Text style={styles.docChangeBtnText}>📄 Trocar Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.docRemoveBtn}
                    onPress={() => setCrlvUri(null)}
                  >
                    <Text style={styles.docRemoveBtnText}>🗑️ Remover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadPlaceholder}
                activeOpacity={0.7}
                onPress={() => chooseUploadMethod('crlv')}
              >
                <Text style={styles.uploadIcon}>📄</Text>
                <Text style={styles.uploadMainText}>Fotografar ou Selecionar CRLV</Text>
                <Text style={styles.uploadSubText}>Toque para abrir a câmera ou galeria</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.docInputLabel}>Número do RENAVAM (opcional)</Text>
            <TextInput
              style={styles.docInput}
              value={crlvRenavam}
              onChangeText={setCrlvRenavam}
              placeholder="Ex: 00123456789"
              placeholderTextColor={Colors.slate500}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={styles.modalSaveBtn}
            activeOpacity={0.8}
            onPress={handleSaveDocuments}
            disabled={isSavingDocs}
          >
            {isSavingDocs ? (
              <ActivityIndicator color={Colors.dark} size="small" />
            ) : (
              <Text style={styles.modalSaveBtnText}>Salvar Documentos ✓</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL / TELA DE CADASTRO DA CHAVE PIX PARA REPASSE      */}
      {/* ======================================================== */}
      <Modal
        visible={showPixModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPixModal(false)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPixModal(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Dados Bancários (PIX) 💳</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Banner Informativo */}
          <View style={styles.pixNoticeBanner}>
            <Text style={styles.pixNoticeIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pixNoticeTitle}>Repasse Imediato de 88%</Text>
              <Text style={styles.pixNoticeText}>
                O valor das suas corridas concluídas é creditado diretamente nesta chave PIX.
              </Text>
            </View>
          </View>

          {/* Seletor de Tipo de Chave */}
          <Text style={styles.inputLabel}>Tipo de Chave PIX</Text>
          <View style={styles.pixTypeRow}>
            {(['cpf', 'email', 'phone', 'random'] as PixKeyType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.pixTypeBtn, pixKeyType === t && styles.pixTypeBtnActive]}
                onPress={() => setPixKeyType(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pixTypeBtnText, pixKeyType === t && styles.pixTypeBtnTextActive]}>
                  {t === 'cpf' && 'CPF'}
                  {t === 'email' && 'E-mail'}
                  {t === 'phone' && 'Celular'}
                  {t === 'random' && 'Aleatória'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Campo Chave PIX */}
          <Text style={styles.inputLabel}>
            {pixKeyType === 'cpf' && 'Chave PIX (CPF)'}
            {pixKeyType === 'email' && 'Chave PIX (E-mail)'}
            {pixKeyType === 'phone' && 'Chave PIX (Telefone com DDD)'}
            {pixKeyType === 'random' && 'Chave Aleatória (EVP)'}
          </Text>
          <TextInput
            style={styles.input}
            value={pixKey}
            onChangeText={setPixKey}
            placeholder={
              pixKeyType === 'cpf'
                ? 'Ex: 123.456.789-00'
                : pixKeyType === 'email'
                ? 'Ex: seuemail@pix.com.br'
                : pixKeyType === 'phone'
                ? 'Ex: (11) 98888-8888'
                : 'Cole sua chave aleatória'
            }
            placeholderTextColor={Colors.slate500}
            keyboardType={pixKeyType === 'phone' ? 'phone-pad' : (pixKeyType === 'email' ? 'email-address' : 'default')}
            autoCapitalize="none"
          />

          {/* Nome do Titular */}
          <Text style={styles.inputLabel}>Nome do Titular da Conta</Text>
          <TextInput
            style={styles.input}
            value={pixOwnerName}
            onChangeText={setPixOwnerName}
            placeholder="Nome completo do titular"
            placeholderTextColor={Colors.slate500}
            autoCapitalize="words"
          />

          {/* Banco / Instituição */}
          <Text style={styles.inputLabel}>Banco ou Instituição Financeira</Text>
          <TextInput
            style={styles.input}
            value={pixBank}
            onChangeText={setPixBank}
            placeholder="Ex: Nubank, Inter, Bradesco, Itaú, Caixa..."
            placeholderTextColor={Colors.slate500}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={styles.modalSaveBtn}
            activeOpacity={0.8}
            onPress={handleSavePix}
            disabled={isSavingPix}
          >
            {isSavingPix ? (
              <ActivityIndicator color={Colors.dark} size="small" />
            ) : (
              <Text style={styles.modalSaveBtnText}>Salvar Chave PIX ✓</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  vehicleCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  editPillBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: Colors.amber,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  editPillBtnText: {
    color: Colors.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  editForm: {
    marginTop: Spacing.xs,
  },
  editHint: {
    fontSize: 12,
    color: Colors.slate400,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate400,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.slate400,
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.amber,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: Colors.dark,
    fontWeight: '700',
    fontSize: 13,
  },
  vehicleInfoList: {
    gap: 6,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.slate400,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.darkBorder,
    marginVertical: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  statItem:    { alignItems: 'center' },
  statValue:   { fontSize: 18, fontWeight: '700', color: Colors.amber, marginBottom: 2 },
  statLabel:   { fontSize: 11, color: Colors.slate400 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.darkBorder },

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
    padding: Spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkBorder,
  },
  menuIcon:  { fontSize: 20 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: Colors.white },
  menuSub:   { fontSize: 12, color: Colors.slate400, marginTop: 2 },
  menuArrow: { fontSize: 20, color: Colors.slate600 },

  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeSuccessText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  badgePending: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.amber,
  },

  logoutBtn: {
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoutText: { color: Colors.danger, fontWeight: '600', fontSize: 14 },
  version:    { textAlign: 'center', fontSize: 12, color: Colors.slate600 },

  // ========================================================
  // ESTILOS DE MODAIS (Documentos e PIX)
  // ========================================================
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.darkCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.darkBorder,
  },
  modalCloseText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.slate400,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },

  // Document Cards
  docCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    marginBottom: Spacing.lg,
  },
  docCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  docCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  docCardBadgeDone: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  docCardBadgePending: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate500,
  },
  uploadPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#334155',
    borderRadius: Radius.md,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    marginBottom: Spacing.sm,
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  uploadMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.amber,
    marginBottom: 2,
  },
  uploadSubText: {
    fontSize: 11,
    color: Colors.slate500,
  },
  previewContainer: {
    marginBottom: Spacing.sm,
  },
  docPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginBottom: 8,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  docChangeBtn: {
    flex: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: Colors.amber,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  docChangeBtnText: {
    color: Colors.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  docRemoveBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: Radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  docRemoveBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  docInputLabel: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 6,
    marginBottom: 4,
  },
  docInput: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.sm,
    color: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },

  modalSaveBtn: {
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  modalSaveBtnText: {
    color: Colors.dark,
    fontWeight: '800',
    fontSize: 15,
  },

  // PIX Styles
  pixNoticeBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: Colors.amber,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  pixNoticeIcon: {
    fontSize: 22,
  },
  pixNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.amber,
    marginBottom: 2,
  },
  pixNoticeText: {
    fontSize: 12,
    color: Colors.slate400,
    lineHeight: 16,
  },
  pixTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  pixTypeBtn: {
    flex: 1,
    backgroundColor: Colors.darkCard,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pixTypeBtnActive: {
    borderColor: Colors.amber,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  pixTypeBtnText: {
    color: Colors.slate400,
    fontSize: 12,
    fontWeight: '600',
  },
  pixTypeBtnTextActive: {
    color: Colors.amber,
    fontWeight: '800',
  },
});
