import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env, allowedOrigins } from './config/env';
import { redis, REDIS_KEYS } from './config/redis';
import { prisma } from './config/database';
import { JwtPayload, DriverLocation } from './shared/types';
import { saveMessage, markMessagesAsRead } from './modules/chat/chat.service';

// ============================================================
// Socket.io -- Comunicacao em tempo real
// Responsavel por: localizacao em tempo real, matching de corridas,
// notificacoes de status e chat entre motorista e passageiro
// ============================================================

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ============================================================
  // Middleware de autenticacao JWT no handshake
  // O cliente deve enviar: { auth: { token: 'Bearer <jwt>' } }
  // ============================================================
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Token de autenticacao nao fornecido'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Token invalido ou expirado'));
    }
  });

  // ============================================================
  // Conexao de clientes
  // ============================================================
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    console.log(`Socket conectado: ${user.userId} (${user.role})`);

    // Adiciona o socket ao room do usuario (para enviar mensagens diretas)
    socket.join(`user:${user.userId}`);

    // ============================================================
    // Motorista fica online
    // ============================================================
    if (user.role === 'DRIVER') {
      handleDriverConnection(socket, io, user.userId);
    }

    // ============================================================
    // Chat em tempo real (Motorista <-> Passageiro)
    // ============================================================

    /**
     * chat:join -- entra no room da corrida para receber mensagens
     * Payload: { rideId: string }
     */
    socket.on('chat:join', ({ rideId }: { rideId: string }) => {
      socket.join(`chat:${rideId}`);
      console.log(`[Chat] ${user.userId} entrou na corrida ${rideId}`);
    });

    /**
     * chat:leave -- sai do room da corrida
     * Payload: { rideId: string }
     */
    socket.on('chat:leave', ({ rideId }: { rideId: string }) => {
      socket.leave(`chat:${rideId}`);
    });

    /**
     * chat:message -- envia uma mensagem
     * Payload: { rideId: string, content: string }
     */
    socket.on('chat:message', async ({ rideId, content }: { rideId: string; content: string }) => {
      try {
        const msg = await saveMessage(rideId, user.userId, user.role, content);
        // Emite para todos no room da corrida (incluindo o remetente)
        io.to(`chat:${rideId}`).emit('chat:message', msg);
      } catch (err: any) {
        socket.emit('chat:error', { message: err.message || 'Erro ao enviar mensagem' });
      }
    });

    /**
     * chat:typing -- indica que o usuario esta digitando
     * Payload: { rideId: string, isTyping: boolean }
     */
    socket.on('chat:typing', ({ rideId, isTyping }: { rideId: string; isTyping: boolean }) => {
      socket.to(`chat:${rideId}`).emit('chat:typing', {
        userId: user.userId,
        role: user.role,
        isTyping,
      });
    });

    /**
     * chat:read -- marca mensagens como lidas
     * Payload: { rideId: string }
     */
    socket.on('chat:read', async ({ rideId }: { rideId: string }) => {
      try {
        await markMessagesAsRead(rideId, user.userId);
        // Notifica o outro participante que as mensagens foram lidas
        socket.to(`chat:${rideId}`).emit('chat:read', { readBy: user.userId });
      } catch {
        // Silencioso
      }
    });

    // ============================================================
    // Desconexao
    // ============================================================
    socket.on('disconnect', async () => {
      console.log(`Socket desconectado: ${user.userId}`);

      if (user.role === 'DRIVER') {
        await handleDriverDisconnect(user.userId);
      }
    });
  });

  return io;
}

// ============================================================
// Handlers de eventos de motorista
// ============================================================

function handleDriverConnection(
  socket: Socket,
  io: SocketServer,
  driverId: string
): void {
  /**
   * Evento: 'driver:location'
   * Motorista envia sua localizacao periodicamente (a cada ~3 segundos)
   * Payload: { lat: number, lng: number, heading?: number }
   */
  socket.on('driver:location', async (data: Omit<DriverLocation, 'driverId' | 'timestamp'>) => {
    try {
      const { lat, lng } = data;

      // Atualiza no Redis GEO index (permite busca por proximidade)
      await redis.call(
        'GEOADD',
        REDIS_KEYS.DRIVERS_ONLINE,
        lng.toString(),
        lat.toString(),
        driverId
      );

      // Atualiza no banco (com debounce implicito via socket)
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: { currentLat: lat, currentLng: lng },
      });

      // Verifica se o motorista tem corrida ativa
      const activeRideId = await redis.get(REDIS_KEYS.DRIVER_ACTIVE_RIDE(driverId));

      if (activeRideId) {
        // Busca o passageiro da corrida ativa
        const ride = await prisma.ride.findUnique({
          where: { id: activeRideId },
          select: { passengerId: true },
        });

        if (ride) {
          // Emite localizacao para o passageiro da corrida ativa
          io.to(`user:${ride.passengerId}`).emit('driver:location:update', {
            driverId,
            lat,
            lng,
            heading: data.heading,
            timestamp: Date.now(),
          } satisfies DriverLocation);
        }
      }
    } catch (err) {
      console.error('Erro ao processar localizacao do motorista:', err);
    }
  });

  /**
   * Evento: 'driver:accept_ride'
   * Motorista aceita uma corrida via Socket.io
   * Payload: { rideId: string }
   */
  socket.on('driver:accept_ride', async (data: { rideId: string }) => {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: data.rideId },
        select: { passengerId: true, status: true },
      });

      if (!ride || ride.status !== 'REQUESTED') {
        socket.emit('error', { message: 'Corrida nao disponivel' });
        return;
      }

      // Notifica o passageiro que o motorista aceitou
      io.to(`user:${ride.passengerId}`).emit('ride:accepted', {
        rideId: data.rideId,
        driverId,
      });

      socket.emit('ride:accept_confirmed', { rideId: data.rideId });
    } catch (err) {
      socket.emit('error', { message: 'Erro ao aceitar corrida' });
    }
  });

  /**
   * Evento: 'driver:arrived'
   * Motorista informa que chegou ao local do passageiro
   */
  socket.on('driver:arrived', async (data: { rideId: string }) => {
    try {
      const ride = await prisma.ride.update({
        where: { id: data.rideId, driverId, status: 'ACCEPTED' },
        data: { status: 'DRIVER_ARRIVING' },
        select: { passengerId: true },
      });

      // Notifica passageiro que o motorista chegou
      io.to(`user:${ride.passengerId}`).emit('driver:arrived', {
        rideId: data.rideId,
        driverId,
      });
    } catch (err) {
      socket.emit('error', { message: 'Erro ao atualizar status de chegada' });
    }
  });
}

/**
 * Limpa dados do motorista ao desconectar
 */
async function handleDriverDisconnect(driverId: string): Promise<void> {
  try {
    // Remove do GEO index do Redis (motorista offline)
    await redis.zrem(REDIS_KEYS.DRIVERS_ONLINE, driverId);

    // Atualiza status offline no banco
    await prisma.driverProfile.updateMany({
      where: { userId: driverId },
      data: { isOnline: false },
    });

    console.log(`Motorista ${driverId} removido do indice de online`);
  } catch (err) {
    console.error(`Erro ao desconectar motorista ${driverId}:`, err);
  }
}

/**
 * Notifica motoristas proximos sobre nova solicitacao de corrida.
 * Chamado pelo rides.service apos criar uma nova corrida.
 */
export async function notifyNearbyDrivers(
  io: SocketServer,
  rideData: {
    rideId: string;
    originLat: number;
    originLng: number;
    destinationAddress: string;
    estimatedKm: number;
    estimatedTotal: number;
    pricePerKm: number;
  }
): Promise<void> {
  try {
    // Busca motoristas online no raio de 5km
    const nearbyDrivers = await redis.call(
      'GEOSEARCH',
      REDIS_KEYS.DRIVERS_ONLINE,
      'FROMLONLAT',
      rideData.originLng.toString(),
      rideData.originLat.toString(),
      'BYRADIUS',
      '5',
      'km',
      'ASC',
      'COUNT',
      '10'
    ) as string[];

    // Envia evento de nova corrida para cada motorista proximo
    for (const driverId of nearbyDrivers) {
      io.to(`user:${driverId}`).emit('ride:new_request', {
        ...rideData,
        expiresAt: Date.now() + 30_000, // 30 segundos para aceitar
      });
    }

    console.log(`Nova corrida ${rideData.rideId} notificada para ${nearbyDrivers.length} motoristas`);
  } catch (err) {
    console.error('Erro ao notificar motoristas:', err);
  }
}