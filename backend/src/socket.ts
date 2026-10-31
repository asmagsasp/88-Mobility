import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env, allowedOrigins } from './config/env';
import { redis, REDIS_KEYS } from './config/redis';
import { prisma } from './config/database';
import { JwtPayload, DriverLocation } from './shared/types';

// ============================================================
// Socket.io — Comunicação em tempo real
// Responsável por: localização em tempo real, matching de corridas
// e notificações de status
// ============================================================

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ============================================================
  // Middleware de autenticação JWT no handshake
  // O cliente deve enviar: { auth: { token: 'Bearer <jwt>' } }
  // ============================================================
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Token de autenticação não fornecido'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Token inválido ou expirado'));
    }
  });

  // ============================================================
  // Conexão de clientes
  // ============================================================
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    console.log(`🔌 Socket conectado: ${user.userId} (${user.role})`);

    // Adiciona o socket ao room do usuário (para enviar mensagens diretas)
    socket.join(`user:${user.userId}`);

    // ============================================================
    // Motorista fica online
    // ============================================================
    if (user.role === 'DRIVER') {
      handleDriverConnection(socket, io, user.userId);
    }

    // ============================================================
    // Desconexão
    // ============================================================
    socket.on('disconnect', async () => {
      console.log(`❌ Socket desconectado: ${user.userId}`);

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
   * Motorista envia sua localização periodicamente (a cada ~3 segundos)
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

      // Atualiza no banco (com debounce implícito via socket)
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
          // Emite localização para o passageiro da corrida ativa
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
      console.error('Erro ao processar localização do motorista:', err);
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
        socket.emit('error', { message: 'Corrida não disponível' });
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
   * Evento: 'ride:request' (emitido pelo backend para motoristas próximos)
   * Os motoristas recebem esse evento quando há uma nova solicitação próxima
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

    console.log(`✅ Motorista ${driverId} removido do índice de online`);
  } catch (err) {
    console.error(`Erro ao desconectar motorista ${driverId}:`, err);
  }
}

/**
 * Notifica motoristas próximos sobre nova solicitação de corrida.
 * Chamado pelo rides.service após criar uma nova corrida.
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

    // Envia evento de nova corrida para cada motorista próximo
    for (const driverId of nearbyDrivers) {
      io.to(`user:${driverId}`).emit('ride:new_request', {
        ...rideData,
        expiresAt: Date.now() + 30_000, // 30 segundos para aceitar
      });
    }

    console.log(`📢 Nova corrida ${rideData.rideId} notificada para ${nearbyDrivers.length} motoristas`);
  } catch (err) {
    console.error('Erro ao notificar motoristas:', err);
  }
}
