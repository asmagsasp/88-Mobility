/**
 * ChatModal — Bate-papo em tempo real entre passageiro e motorista
 * Sincronizado via canal em tempo real do 88 Mobility + persistência local AsyncStorage
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { publishRideEvent, pollRideEvents } from '../services/rideSync';

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
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
  /** Nome exibido como header (ex: "Chat com Motorista") */
  otherPartyName?: string;
  /** Callback quando chegar nova mensagem */
  onNewMessage?: () => void;
}

// ----------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------
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
  const lastPollTimeRef = useRef<number>(Math.floor(Date.now() / 1000) - 60);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const storageKey = `@88mobility_chat_${rideId}`;

  // ---------------------------------------------------------------
  // 1. Carrega histórico de mensagens do AsyncStorage
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // 2. Polling ativo enquanto o modal estiver aberto
  // ---------------------------------------------------------------
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
        const { events, latestTime } = await pollRideEvents(lastPollTimeRef.current);
        lastPollTimeRef.current = latestTime;

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

  // ---------------------------------------------------------------
  // 3. Enviar mensagem
  // ---------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || sending || !rideId) return;

    setSending(true);
    setInputText('');
    Keyboard.dismiss();

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rideId,
      senderId: currentUserId || `${currentUserRole.toLowerCase()}-${Date.now()}`,
      senderRole: currentUserRole,
      content,
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    // 1. Atualiza lista local imediatamente
    setMessages((prev) => {
      const next = [...prev, newMsg];
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return next;
    });

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    // 2. Transmite mensagem pelo canal em tempo real
    await publishRideEvent({
      type: 'CHAT_MESSAGE',
      rideId,
      message: newMsg,
    });

    // 3. Cancela status de "digitando"
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

  // ---------------------------------------------------------------
  // 4. Indicador de digitação
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // Renderização de cada mensagem
  // ---------------------------------------------------------------
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
        <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeOther]}>
          {time}
        </Text>
      </View>
    );
  };

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{otherPartyName}</Text>
          <View style={{ width: 36 }} />
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
              <Text style={styles.emptyText}>Nenhuma mensagem ainda. Diga oi! 👋</Text>
            }
          />
        )}

        {/* Indicador "digitando..." */}
        {otherTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>digitando...</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="Digite uma mensagem..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ----------------------------------------------------------------
// Estilos
// ----------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#003580',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  messageList: {
    padding: 12,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '78%',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#003580',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#fff',
  },
  bubbleTextOther: {
    color: '#1a1a1a',
  },
  bubbleTime: {
    fontSize: 11,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  bubbleTimeOther: {
    color: '#888',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
    fontSize: 14,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  typingText: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#f0f2f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    marginRight: 8,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#003580',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 2,
  },
});
