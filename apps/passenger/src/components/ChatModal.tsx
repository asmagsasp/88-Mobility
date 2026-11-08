/**
 * ChatModal — Bate-papo em tempo real entre passageiro e motorista
 * Visual estilo WhatsApp com 2 ticks azuis de confirmação de envio (✓✓),
 * barra de digitação mais alta e botão de fechar (X) acessível na parte inferior.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { publishRideEvent, pollRideEvents } from '../services/rideSync';

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: string; // PASSENGER | DRIVER
  content: string;
  readAt?: string | null;
  createdAt: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  currentUserId: string;
  currentUserRole: 'PASSENGER' | 'DRIVER';
  otherPartyName?: string;
  onNewMessage?: () => void;
}

export function ChatModal({
  visible,
  onClose,
  rideId,
  currentUserId,
  currentUserRole,
  otherPartyName = 'Chat',
  onNewMessage,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const storageKey = `@88mobility_chat_${rideId}`;

  // 1. Carrega histórico de mensagens do AsyncStorage
  const loadMessagesFromStorage = useCallback(async () => {
    if (!rideId) return;
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        setMessages(parsed);
      }
    } catch (e) {
      console.warn('[Chat] Erro ao carregar histórico local:', e);
    }
  }, [rideId, storageKey]);

  // 2. Polling ativo enquanto o modal estiver aberto
  useEffect(() => {
    if (!visible || !rideId) return;

    let isMounted = true;
    setLoading(true);

    loadMessagesFromStorage().finally(() => {
      if (isMounted) setLoading(false);
    });

    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const { events } = await pollRideEvents();

        for (const ev of events) {
          if (ev.type === 'CHAT_MESSAGE' && ev.rideId === rideId) {
            const incomingMsg: ChatMessage = { ...ev.message, readAt: null };

            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) return prev;
              const next = [...prev, incomingMsg];
              AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
              return next;
            });

            if (incomingMsg.senderId !== currentUserId) {
              onNewMessage?.();
            }

            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          } else if (ev.type === 'CHAT_TYPING' && ev.rideId === rideId) {
            if (ev.userId !== currentUserId) {
              setOtherTyping(ev.isTyping);
            }
          }
        }
      } catch (err) {
        console.warn('[Chat] Erro no polling de mensagens:', err);
      }
    }, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [visible, rideId, currentUserId, loadMessagesFromStorage, onNewMessage, storageKey]);

  // 3. Enviar mensagem
  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || sending || !rideId) return;

    setSending(true);
    setInputText('');

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rideId,
      senderId: currentUserId || `${currentUserRole.toLowerCase()}-${Date.now()}`,
      senderRole: currentUserRole,
      content,
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    // Atualiza lista local imediatamente
    setMessages((prev) => {
      const next = [...prev, newMsg];
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return next;
    });

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    // Transmite mensagem pelo canal em tempo real
    publishRideEvent({
      type: 'CHAT_MESSAGE',
      rideId,
      message: newMsg,
    }).catch(() => {});

    // Cancela status de "digitando"
    if (isTypingRef.current) {
      isTypingRef.current = false;
      publishRideEvent({
        type: 'CHAT_TYPING',
        rideId,
        userId: currentUserId,
        isTyping: false,
      }).catch(() => {});
    }

    setSending(false);
  }, [inputText, sending, rideId, currentUserId, currentUserRole, storageKey]);

  // 4. Indicador de digitação
  const handleTyping = useCallback(
    (text: string) => {
      setInputText(text);

      if (!rideId) return;

      if (!isTypingRef.current && text.length > 0) {
        isTypingRef.current = true;
        publishRideEvent({
          type: 'CHAT_TYPING',
          rideId,
          userId: currentUserId,
          isTyping: true,
        }).catch(() => {});
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        publishRideEvent({
          type: 'CHAT_TYPING',
          rideId,
          userId: currentUserId,
          isTyping: false,
        }).catch(() => {});
      }, 2500);
    },
    [rideId, currentUserId]
  );

  // Renderização de cada mensagem com 2 ticks azuis estilo WhatsApp
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === currentUserId || item.senderRole === currentUserRole;
    const time = new Date(item.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
          {item.content}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeOther]}>
            {time}
          </Text>
          {isMine && (
            <Text style={styles.ticksBlue}>✓✓</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Header Superior */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← Voltar</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {otherPartyName}
              </Text>
              <Text style={styles.headerStatus}>● Em tempo real</Text>
            </View>
            <View style={{ width: 60 }} />
          </View>

          {/* Lista de mensagens */}
          {loading ? (
            <ActivityIndicator style={{ flex: 1 }} size="large" color="#003580" />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>💬</Text>
                  <Text style={styles.emptyText}>Nenhuma mensagem ainda.</Text>
                  <Text style={styles.emptySubText}>Combine detalhes da corrida diretamente por aqui!</Text>
                </View>
              }
            />
          )}

          {/* Indicador "digitando..." */}
          {otherTyping && (
            <View style={styles.typingContainer}>
              <Text style={styles.typingText}>digitando...</Text>
            </View>
          )}

          {/* Barra de Digitação (Mais em cima e ergonômica) */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={handleTyping}
              placeholder="Digite uma mensagem..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>➤</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Barra inferior com o "X Fechar" mais embaixo para fácil alcance */}
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={onClose} style={styles.bottomCloseBtn} activeOpacity={0.7}>
              <Text style={styles.bottomCloseBtnText}>✕ Fechar Chat</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? 38 : 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  backBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerStatus: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  messageList: {
    padding: 16,
    paddingBottom: 12,
  },
  bubble: {
    maxWidth: '80%',
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderRadius: 18,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#065F46', // Verde escuro elegante estilo WhatsApp
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleTextOther: {
    color: '#F8FAFC',
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 11,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  bubbleTimeOther: {
    color: '#94A3B8',
  },
  ticksBlue: {
    color: '#38BDF8', // Dois ticks azuis vibrantes estilo WhatsApp
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  typingText: {
    color: '#38BDF8',
    fontStyle: 'italic',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#0F172A',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 2,
  },
  bottomBar: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  bottomCloseBtn: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  bottomCloseBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
});
