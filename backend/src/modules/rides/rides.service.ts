import { Client as GoogleMapsClient, UnitSystem } from '@googlemaps/google-maps-services-js';
import { RideStatus } from '../../shared/types/enums';
import { prisma } from '../../config/database';
import { redis, REDIS_KEYS } from '../../config/redis';
import { env } from '../../config/env';
import { AppError } from '../../shared/middleware/error.middleware';
import { haversineDistance, estimateArrivalMinutes } from '../../shared/utils/geo';
import { RideEstimate, NearbyDriver } from '../../shared/types';
import { EstimateRideDto, RequestRideDto } from './rides.dto';

const mapsClient = new GoogleMapsClient({});

// Split fixo da plataforma (sobre o valor por Km)
const DRIVER_SPLIT = 0.88;
const PLATFORM_SPLIT = 0.12;

// Taxa fixa padrão de manutenção da plataforma (fallback se não houver config)
const DEFAULT_PLATFORM_FEE = 2.00;

// ============================================================
// Rides Service — Lógica central de corridas
// ============================================================

/**
 * Busca a configuração de preço ativa no banco.
 * Lança erro se não houver config cadastrada.
 */
async function getActivePricing() {
  const config = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!config) {
    throw new AppError(
      'Preço por Km não configurado. Contate o administrador.',
      503
    );
  }

  return config;
}

/**
 * Estima o custo de uma corrida antes de solicitá-la.
 * Tenta usar Google Maps Routes API para distância real;
 * fallback para cálculo haversine se a API falhar.
 */
export async function estimateRide(dto: EstimateRideDto): Promise<RideEstimate> {
  const pricing = await getActivePricing();
  let estimatedKm: number;
  let estimatedMinutes: number;

  try {
    // Tenta buscar rota real pelo Google Maps
    const response = await mapsClient.distancematrix({
      params: {
        origins: [`${dto.originLat},${dto.originLng}`],
        destinations: [`${dto.destinationLat},${dto.destinationLng}`],
        key: env.GOOGLE_MAPS_API_KEY,
        units: UnitSystem.metric,
      },
    });

    const element = response.data.rows[0]?.elements[0];

    if (element?.status === 'OK' && element.distance && element.duration) {
      estimatedKm = Math.round((element.distance.value / 1000) * 100) / 100;
      estimatedMinutes = Math.ceil(element.duration.value / 60);
    } else {
      throw new Error('Google Maps não retornou rota válida');
    }
  } catch {
    // Fallback: usa haversine (linha reta × fator de tortuosidade 1.35)
    console.warn('⚠️  Google Maps falhou, usando haversine como fallback');
    const straightKm = haversineDistance(
      dto.originLat,
      dto.originLng,
      dto.destinationLat,
      dto.destinationLng
    );
    estimatedKm = Math.round(straightKm * 1.35 * 100) / 100;
    estimatedMinutes = estimateArrivalMinutes(estimatedKm);
  }

  const kmAmount    = Math.round(estimatedKm * pricing.pricePerKm * 100) / 100;
  const platformFee = pricing.platformFee ?? DEFAULT_PLATFORM_FEE;
  const estimatedTotal = Math.round((kmAmount + platformFee) * 100) / 100;
  // Split aplicado somente sobre o valor por Km (a taxa fixa vai integralmente à plataforma)
  const driverAmount   = Math.round(kmAmount * DRIVER_SPLIT * 100) / 100;
  const platformAmount = Math.round((kmAmount * PLATFORM_SPLIT + platformFee) * 100) / 100;

  return {
    estimatedKm,
    pricePerKm: pricing.pricePerKm,
    platformFee: pricing.platformFee ?? DEFAULT_PLATFORM_FEE,
    estimatedTotal,
    driverAmount,
    platformAmount,
    estimatedMinutes,
  };
}

/**
 * Solicita uma corrida.
 * IMPORTANTE: Faz snapshot do pricePerKm atual — corridas em andamento
 * não são afetadas por futuras mudanças de preço pelo admin.
 */
export async function requestRide(passengerId: string, dto: RequestRideDto) {
  // Verifica se o passageiro não tem corrida ativa
  const activeRide = await prisma.ride.findFirst({
    where: {
      passengerId,
      status: {
        in: [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.DRIVER_ARRIVING, RideStatus.IN_PROGRESS],
      },
    },
  });

  if (activeRide) {
    throw new AppError('Você já tem uma corrida em andamento', 409);
  }

  const pricing = await getActivePricing();

  // Estima distância
  const estimate = await estimateRide({
    originLat: dto.originLat,
    originLng: dto.originLng,
    destinationLat: dto.destinationLat,
    destinationLng: dto.destinationLng,
  });

  // Cria a corrida com SNAPSHOT do preço atual
  const ride = await prisma.ride.create({
    data: {
      passengerId,
      status: RideStatus.REQUESTED,
      originLat: dto.originLat,
      originLng: dto.originLng,
      originAddress: dto.originAddress,
      destinationLat: dto.destinationLat,
      destinationLng: dto.destinationLng,
      destinationAddress: dto.destinationAddress,
      estimatedKm: estimate.estimatedKm,
      pricePerKm: pricing.pricePerKm,    // ← SNAPSHOT do preço por Km
      platformFee: pricing.platformFee ?? DEFAULT_PLATFORM_FEE, // ← SNAPSHOT da taxa fixa
      paymentMethod: dto.paymentMethod,
    },
    include: {
      passenger: { select: { name: true, phone: true } },
    },
  });

  // Publica no Redis para o sistema de matching em tempo real
  await redis.setex(
    REDIS_KEYS.RIDE_REQUEST(ride.id),
    300, // expira em 5 minutos
    JSON.stringify({
      rideId: ride.id,
      passengerId,
      originLat: dto.originLat,
      originLng: dto.originLng,
      destinationAddress: dto.destinationAddress,
      estimatedKm: estimate.estimatedKm,
      estimatedTotal: estimate.estimatedTotal,
      pricePerKm: pricing.pricePerKm,
    })
  );

  // Salva corrida ativa do passageiro no Redis
  await redis.setex(REDIS_KEYS.PASSENGER_ACTIVE_RIDE(passengerId), 3600, ride.id);

  return { ride, estimate };
}

/**
 * Busca motoristas online próximos usando o GEO index do Redis.
 * Redis GEOSEARCH retorna os motoristas dentro do raio especificado.
 */
export async function getNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm = 5
): Promise<NearbyDriver[]> {
  try {
    // GEOSEARCH retorna [member, distance, [lng, lat]]
    const results = await redis.call(
      'GEOSEARCH',
      REDIS_KEYS.DRIVERS_ONLINE,
      'FROMLONLAT',
      lng.toString(),
      lat.toString(),
      'BYRADIUS',
      radiusKm.toString(),
      'km',
      'ASC',
      'COUNT',
      '10',
      'WITHCOORD',
      'WITHDIST'
    ) as unknown[][];

    return results.map((item: unknown[]) => {
      const member = item[0] as string;
      const distance = parseFloat(item[1] as string);
      const coord = item[2] as [string, string];

      return {
        driverId: member,
        distanceKm: Math.round(distance * 100) / 100,
        lng: parseFloat(coord[0]),
        lat: parseFloat(coord[1]),
      };
    });
  } catch (err) {
    console.error('Erro ao buscar motoristas no Redis:', err);
    return [];
  }
}

/**
 * Motorista aceita uma corrida
 */
export async function acceptRide(driverId: string, rideId: string) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });

  if (!ride) throw new AppError('Corrida não encontrada', 404);
  if (ride.status !== RideStatus.REQUESTED) {
    throw new AppError('Esta corrida não está mais disponível', 409);
  }

  // Verifica se o motorista está aprovado
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
  });

  if (!driverProfile?.isApproved) {
    throw new AppError('Motorista não aprovado para realizar corridas', 403);
  }

  // Verifica se o motorista não tem corrida ativa
  const activeRide = await redis.get(REDIS_KEYS.DRIVER_ACTIVE_RIDE(driverId));
  if (activeRide) {
    throw new AppError('Você já tem uma corrida ativa', 409);
  }

  const updatedRide = await prisma.ride.update({
    where: { id: rideId },
    data: { driverId, status: RideStatus.ACCEPTED },
    include: {
      passenger: { select: { name: true, phone: true } },
      driver: { select: { name: true, phone: true } },
    },
  });

  // Salva corrida ativa do motorista no Redis
  await redis.setex(REDIS_KEYS.DRIVER_ACTIVE_RIDE(driverId), 7200, rideId);

  // Remove solicitação do Redis (já foi aceita)
  await redis.del(REDIS_KEYS.RIDE_REQUEST(rideId));

  return updatedRide;
}

/**
 * Motorista inicia a corrida (passageiro embarcou)
 */
export async function startRide(driverId: string, rideId: string) {
  const ride = await prisma.ride.findFirst({
    where: { id: rideId, driverId },
  });

  if (!ride) throw new AppError('Corrida não encontrada', 404);

  if (ride.status !== RideStatus.ACCEPTED && ride.status !== RideStatus.DRIVER_ARRIVING) {
    throw new AppError('Corrida não pode ser iniciada neste estado', 409);
  }

  return prisma.ride.update({
    where: { id: rideId },
    data: { status: RideStatus.IN_PROGRESS, startedAt: new Date() },
  });
}

/**
 * Motorista finaliza a corrida.
 * Calcula o valor final com o Km REAL rodado × pricePerKm (snapshot salvo na criação).
 * O split 88/12 é aplicado sobre o valor final real.
 */
export async function completeRide(driverId: string, rideId: string, actualKm: number) {
  const ride = await prisma.ride.findFirst({
    where: { id: rideId, driverId },
  });

  if (!ride) throw new AppError('Corrida não encontrada', 404);
  if (ride.status !== RideStatus.IN_PROGRESS) {
    throw new AppError('Corrida não está em andamento', 409);
  }

  // Cálculo financeiro usando o SNAPSHOT do pricePerKm e platformFee
  const kmAmount    = Math.round(actualKm * ride.pricePerKm * 100) / 100;
  const platformFee = ride.platformFee ?? DEFAULT_PLATFORM_FEE;
  const totalAmount    = Math.round((kmAmount + platformFee) * 100) / 100;
  // 88% sobre o valor por Km; taxa fixa vai integralmente à plataforma
  const driverAmount   = Math.round(kmAmount * DRIVER_SPLIT * 100) / 100;
  const platformAmount = Math.round((kmAmount * PLATFORM_SPLIT + platformFee) * 100) / 100;

  const [updatedRide] = await prisma.$transaction([
    prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.COMPLETED,
        actualKm,
        totalAmount,
        driverAmount,
        platformAmount,
        completedAt: new Date(),
      },
    }),
    // Atualiza totais do motorista
    prisma.driverProfile.update({
      where: { userId: driverId },
      data: {
        totalKm: { increment: actualKm },
        totalEarnings: { increment: driverAmount },
      },
    }),
  ]);

  // Remove corrida ativa do Redis
  await Promise.all([
    redis.del(REDIS_KEYS.DRIVER_ACTIVE_RIDE(driverId)),
    redis.del(REDIS_KEYS.PASSENGER_ACTIVE_RIDE(ride.passengerId)),
  ]);

  return { ride: updatedRide, totalAmount, driverAmount, platformAmount };
}

/**
 * Cancela uma corrida (passageiro ou motorista)
 */
export async function cancelRide(userId: string, rideId: string, reason?: string) {
  const ride = await prisma.ride.findFirst({
    where: {
      id: rideId,
      OR: [{ passengerId: userId }, { driverId: userId }],
    },
  });

  if (!ride) throw new AppError('Corrida não encontrada', 404);

  const cancellableStatuses: RideStatus[] = [
    RideStatus.REQUESTED,
    RideStatus.ACCEPTED,
    RideStatus.DRIVER_ARRIVING,
  ];

  if (!cancellableStatuses.includes(ride.status as RideStatus)) {
    throw new AppError('Corrida não pode ser cancelada neste estado', 409);
  }

  const updatedRide = await prisma.ride.update({
    where: { id: rideId },
    data: {
      status: RideStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  // Limpa Redis
  const cleanupKeys: string[] = [REDIS_KEYS.RIDE_REQUEST(rideId)];
  if (ride.driverId) cleanupKeys.push(REDIS_KEYS.DRIVER_ACTIVE_RIDE(ride.driverId));
  cleanupKeys.push(REDIS_KEYS.PASSENGER_ACTIVE_RIDE(ride.passengerId));
  await Promise.all(cleanupKeys.map((k) => redis.del(k)));

  return updatedRide;
}

/**
 * Publica um evento de sincronização no banco SQLite
 */
export async function publishSyncEvent(rideId: string, type: string, payload: any) {
  const event = await prisma.rideSyncEvent.create({
    data: {
      rideId,
      type,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    },
  });
  return event;
}

/**
 * Consulta eventos de sincronização recentes do banco SQLite
 */
export async function getSyncEvents(since?: Date) {
  const where = since ? { createdAt: { gt: since } } : {};
  const events = await prisma.rideSyncEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return events.map((e) => {
    try {
      return {
        id: e.id,
        rideId: e.rideId,
        type: e.type,
        payload: JSON.parse(e.payload),
        createdAt: e.createdAt,
      };
    } catch {
      return {
        id: e.id,
        rideId: e.rideId,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt,
      };
    }
  });
}

/**
 * Busca histórico de corridas de um usuário
 */
export async function getRideHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      where: { OR: [{ passengerId: userId }, { driverId: userId }] },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { name: true, avatar: true, rating: true } },
        driver: { select: { name: true, avatar: true, rating: true } },
      },
    }),
    prisma.ride.count({
      where: { OR: [{ passengerId: userId }, { driverId: userId }] },
    }),
  ]);

  return { rides, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Busca uma corrida específica (com verificação de acesso)
 */
export async function getRideById(userId: string, rideId: string) {
  const ride = await prisma.ride.findFirst({
    where: {
      id: rideId,
      OR: [{ passengerId: userId }, { driverId: userId }],
    },
    include: {
      passenger: { select: { name: true, phone: true, avatar: true, rating: true } },
      driver: { select: { name: true, phone: true, avatar: true, rating: true } },
      ratings: true,
    },
  });

  if (!ride) throw new AppError('Corrida não encontrada', 404);
  return ride;
}
