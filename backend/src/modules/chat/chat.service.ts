import { prisma } from '../../config/database';

// ============================================================
// Chat Service — Mensagens em tempo real (Motorista <-> Passageiro)
// ============================================================

export interface ChatMessageData {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

/**
 * Busca o histórico de mensagens de uma corrida.
 * Apenas participantes da corrida podem acessar.
 */
export async function getMessages(
  rideId: string,
  requesterId: string
): Promise<ChatMessageData[]> {
  // Verifica se o solicitante é participante da corrida
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { passengerId: true, driverId: true },
  });

  if (!ride) {
    throw Object.assign(new Error('Corrida não encontrada'), { status: 404 });
  }

  if (ride.passengerId !== requesterId && ride.driverId !== requesterId) {
    throw Object.assign(new Error('Acesso negado'), { status: 403 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { rideId },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((m) => ({
    id: m.id,
    rideId: m.rideId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    content: m.content,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  }));
}

/**
 * Salva uma mensagem no banco e retorna o objeto completo.
 */
export async function saveMessage(
  rideId: string,
  senderId: string,
  senderRole: string,
  content: string
): Promise<ChatMessageData> {
  // Valida que a corrida existe e o remetente é participante
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { passengerId: true, driverId: true, status: true },
  });

  if (!ride) {
    throw Object.assign(new Error('Corrida não encontrada'), { status: 404 });
  }

  if (ride.passengerId !== senderId && ride.driverId !== senderId) {
    throw Object.assign(new Error('Acesso negado'), { status: 403 });
  }

  if (content.trim().length === 0) {
    throw Object.assign(new Error('Mensagem não pode ser vazia'), { status: 400 });
  }

  if (content.length > 500) {
    throw Object.assign(new Error('Mensagem muito longa (máximo 500 caracteres)'), { status: 400 });
  }

  const message = await prisma.chatMessage.create({
    data: { rideId, senderId, senderRole, content: content.trim() },
  });

  return {
    id: message.id,
    rideId: message.rideId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    content: message.content,
    readAt: message.readAt ? message.readAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Marca todas as mensagens de uma corrida como lidas para um usuário.
 */
export async function markMessagesAsRead(
  rideId: string,
  readerId: string
): Promise<void> {
  // Marca como lidas as mensagens que NÃO foram enviadas pelo leitor
  await prisma.chatMessage.updateMany({
    where: {
      rideId,
      senderId: { not: readerId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

/**
 * Conta mensagens não lidas de uma corrida para um usuário.
 */
export async function countUnread(
  rideId: string,
  userId: string
): Promise<number> {
  return prisma.chatMessage.count({
    where: {
      rideId,
      senderId: { not: userId },
      readAt: null,
    },
  });
}
