/**
 * ChatModal — Bate-papo em tempo real entre passageiro e motorista
 * Usado durante corrida ativa.
 *
 * Funcionalidades:
 * - Mensagens em tempo real via Socket.io
 * - Indicador "digitando..."
 * - Badge de mensagens nao lidas
 * - Historico carregado via API REST
 * - Interface estilo WhatsApp (bolhas)
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
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const SOCKET_URL = API_URL.replace('/api', '');

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: string; // PASSENGER | DRIVER
  content: string;
  readAt: string | null;
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
  /** Callback quando chegar nova mensagem (para badge externo) */
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
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ---------------------------------------------------------------
  // Carrega historico via REST
  // ---------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('@88mobility_token');
      const res = await fetch(`${API_URL}/rides/${rideId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch {
      // Silencioso — WebSocket ja cobre mensagens em tempo real
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  // ---------------------------------------------------------------
  // Conecta Socket.io quando o modal abre
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!visible || !rideId) return;

    loadHistory();

    let socket: Socket;

    const connect = async () => {
      const token = await AsyncStorage.getItem('@88mobility_token');
      socket = io(SOCKET_URL, {
        auth: { token: `Bearer ${token}` },
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('chat:join', { rideId });
        // Marca mensagens como lidas ao abrir
        socket.emit('chat:read', { rideId });
      });

      // Nova mensagem
      socket.on('chat:message', (msg: ChatMessage) => {
        setMessages((prev) => {
          // Evita duplicata
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Avisa badge externo se mensagem nao e minha
        if (msg.senderId !== currentUserId) {
          onNewMessage?.();
          // Marca como lida automaticamente se o modal estiver aberto
          socket.emit('chat:read', { rideId });
        }
        // Scroll para o fim
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      });

      // Indicador "digitando..."
      socket.on('chat:typing', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
        if (userId !== currentUserId) {
          setOtherTyping(isTyping);
        }
      });
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { rideId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [visible, rideId]);

  // ---------------------------------------------------------------
  // Enviar mensagem
  // ---------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || sending) return;

    setSending(true);
    setInputText('');
    Keyboard.dismiss();

    // Envia via Socket.io (preferido)
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', { rideId, content });
      // Cancela "typing"
      socketRef.current.emit('chat:typing', { rideId, isTyping: false });
      isTypingRef.current = false;
    } else {
      // Fallback: REST API
      try {
        const token = await AsyncStorage.getItem('@88mobility_token');
        const res = await fetch(`${API_URL}/rides/${rideId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, data.message]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      } catch {
        // Falha silenciosa
      }
    }

    setSending(false);
  }, [inputText, rideId, sending]);

  // ---------------------------------------------------------------
  // Indicador de digitacao (debounce 2s)
  // ---------------------------------------------------------------
  const handleTyping = useCallback(
    (text: string) => {
      setInputText(text);

      if (!socketRef.current?.connected) return;

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socketRef.current.emit('chat:typing', { rideId, isTyping: true });
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socketRef.current?.emit('chat:typing', { rideId, isTyping: false });
      }, 2000);
    },
    [rideId]
  );

  // ---------------------------------------------------------------
  // Renderizacao de cada mensagem
  // ---------------------------------------------------------------
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === currentUserId;
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
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
    paddingBottom: 4,
  },
  bubble: {
    maxWidth: '75%',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
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
    shadowOpacity: 0.06,
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
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
  },
  bubbleTimeOther: {
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 60,
    fontSize: 14,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  typingText: {
    color: '#888',
    fontStyle: 'italic',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1a1a1a',
    marginRight: 8,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#003580',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 2,
  },
});
