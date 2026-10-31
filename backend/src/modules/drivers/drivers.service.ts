import { prisma } from '../../config/database';
import { redis, REDIS_KEYS } from '../../config/redis';
import { AppError } from '../../shared/middleware/error.middleware';

// ============================================================
// Drivers Service — Gerenciamento de motoristas
// ============================================================

/**
 * Retorna o perfil detalhado do motorista
 */
export async function getDriverProfile(userId: string) {
  const driver = await prisma.user.findUnique({
    where: { id: userId, role: 'DRIVER' },
    include: {
      driverProfile: true,
      _count: {
        select: {
          ridesAsDriver: { where: { status: 'COMPLETED' } },
        },
      },
    },
  });

  if (!driver) throw new AppError('Motorista não encontrado', 404);
  return driver;
}

/**
 * Motorista atualiza sua localização em tempo real.
 * Salva no Redis GEO index para busca por proximidade.
 */
export async function updateLocation(
  driverId: string,
  lat: number,
  lng: number
): Promise<void> {
  // Verifica se o motorista está aprovado e ativo
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { isApproved: true, isOnline: true },
  });

  if (!profile?.isApproved) {
    throw new AppError('Motorista não aprovado', 403);
  }

  // Atualiza no banco de dados
  await prisma.driverProfile.update({
    where: { userId: driverId },
    data: { currentLat: lat, currentLng: lng },
  });

  // Se estiver online, atualiza no Redis GEO index
  if (profile.isOnline) {
    await redis.call('GEOADD', REDIS_KEYS.DRIVERS_ONLINE, lng.toString(), lat.toString(), driverId);
  }
}

/**
 * Altera o status online/offline do motorista
 */
export async function setOnlineStatus(driverId: string, isOnline: boolean) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { isApproved: true, currentLat: true, currentLng: true },
  });

  if (!profile) throw new AppError('Perfil de motorista não encontrado', 404);
  if (!profile.isApproved) throw new AppError('Motorista não aprovado para ficar online', 403);

  await prisma.driverProfile.update({
    where: { userId: driverId },
    data: { isOnline },
  });

  if (isOnline && profile.currentLat && profile.currentLng) {
    // Adiciona ao GEO index do Redis
    await redis.call(
      'GEOADD',
      REDIS_KEYS.DRIVERS_ONLINE,
      profile.currentLng.toString(),
      profile.currentLat.toString(),
      driverId
    );
  } else if (!isOnline) {
    // Remove do GEO index do Redis
    await redis.zrem(REDIS_KEYS.DRIVERS_ONLINE, driverId);
  }

  return { isOnline, message: isOnline ? 'Você está online' : 'Você está offline' };
}

/**
 * Busca ganhos do motorista com detalhamento por período
 */
export async function getEarnings(
  driverId: string,
  period: 'day' | 'week' | 'month' = 'week'
) {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const [rides, profile] = await Promise.all([
    prisma.ride.findMany({
      where: {
        driverId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        actualKm: true,
        driverAmount: true,
        totalAmount: true,
        pricePerKm: true,
        completedAt: true,
        originAddress: true,
        destinationAddress: true,
      },
    }),
    prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { totalKm: true, totalEarnings: true },
    }),
  ]);

  const periodEarnings = rides.reduce((sum, r) => sum + (r.driverAmount ?? 0), 0);
  const periodKm = rides.reduce((sum, r) => sum + (r.actualKm ?? 0), 0);

  return {
    period,
    startDate,
    periodEarnings: Math.round(periodEarnings * 100) / 100,
    periodKm: Math.round(periodKm * 100) / 100,
    totalEarnings: profile?.totalEarnings ?? 0,
    totalKm: profile?.totalKm ?? 0,
    rides,
  };
}
