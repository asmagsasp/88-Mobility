import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { PlatformStats, PaginatedResponse } from '../../shared/types';
import { RideStatus } from '../../shared/types/enums';

// ============================================================
// Admin Service — Gerenciamento da plataforma pelo administrador
// ============================================================

/**
 * Retorna a configuração de preço ativa atual
 */
export async function getPricingConfig() {
  const config = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      admin: { select: { name: true, email: true } },
    },
  });

  if (!config) {
    throw new AppError('Nenhuma configuração de preço encontrada. Configure o preço por Km.', 404);
  }

  return config;
}

/**
 * Atualiza o preço por Km.
 * Desativa a configuração anterior e cria uma nova.
 * Isso garante histórico completo de mudanças de preço.
 */
export async function updatePricingConfig(
  pricePerKm: number,
  adminId: string,
  driverSplit = 0.88,
  platformSplit = 0.12
) {
  if (Math.abs(driverSplit + platformSplit - 1) > 0.001) {
    throw new AppError('A soma dos splits deve ser 100%', 400);
  }

  const config = await prisma.$transaction(async (tx) => {
    // Desativa configurações anteriores
    await tx.pricingConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Cria nova configuração ativa
    return tx.pricingConfig.create({
      data: {
        pricePerKm,
        driverSplit,
        platformSplit,
        isActive: true,
        updatedBy: adminId,
      },
    });
  });

  return config;
}

/**
 * Retorna estatísticas gerais da plataforma
 */
export async function getStats(): Promise<PlatformStats> {
  const [
    totalRides,
    completedRides,
    cancelledRides,
    revenueAgg,
    activeDrivers,
    totalPassengers,
    ratingAgg,
  ] = await Promise.all([
    prisma.ride.count(),
    prisma.ride.count({ where: { status: RideStatus.COMPLETED } }),
    prisma.ride.count({ where: { status: RideStatus.CANCELLED } }),
    prisma.ride.aggregate({
      where: { status: RideStatus.COMPLETED },
      _sum: { totalAmount: true, platformAmount: true, driverAmount: true, actualKm: true },
    }),
    prisma.driverProfile.count({ where: { isOnline: true } }),
    prisma.user.count({ where: { role: 'PASSENGER' } }),
    prisma.rating.aggregate({ _avg: { score: true } }),
  ]);

  return {
    totalRides,
    completedRides,
    cancelledRides,
    totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    platformRevenue: revenueAgg._sum.platformAmount ?? 0,
    driverRevenue: revenueAgg._sum.driverAmount ?? 0,
    totalKm: revenueAgg._sum.actualKm ?? 0,
    activeDrivers,
    totalPassengers,
    averageRating: ratingAgg._avg.score ?? 0,
  };
}

/**
 * Retorna dados do dashboard: stats + últimas 10 corridas
 */
export async function getDashboardData() {
  const [stats, recentRides] = await Promise.all([
    getStats(),
    prisma.ride.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { name: true, phone: true } },
        driver: { select: { name: true, phone: true } },
      },
    }),
  ]);

  return { stats, recentRides };
}

/**
 * Lista motoristas com paginação e filtros
 */
export async function listDrivers(
  page = 1,
  limit = 20,
  filter?: { isApproved?: boolean; isOnline?: boolean; search?: string }
): Promise<PaginatedResponse<unknown>> {
  const skip = (page - 1) * limit;

  const where = {
    role: 'DRIVER' as const,
    ...(filter?.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: 'insensitive' as const } },
            { email: { contains: filter.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(filter?.isApproved !== undefined || filter?.isOnline !== undefined
      ? {
          driverProfile: {
            ...(filter?.isApproved !== undefined ? { isApproved: filter.isApproved } : {}),
            ...(filter?.isOnline !== undefined ? { isOnline: filter.isOnline } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        driverProfile: {
          select: {
            isApproved: true,
            isOnline: true,
            vehicleModel: true,
            vehiclePlate: true,
            vehicleColor: true,
            totalKm: true,
            totalEarnings: true,
            documentsVerified: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Aprova um motorista para operar na plataforma
 */
export async function approveDriver(driverId: string) {
  const driver = await prisma.user.findUnique({
    where: { id: driverId, role: 'DRIVER' },
    include: { driverProfile: true },
  });

  if (!driver || !driver.driverProfile) {
    throw new AppError('Motorista não encontrado', 404);
  }

  if (driver.driverProfile.isApproved) {
    throw new AppError('Motorista já está aprovado', 400);
  }

  await prisma.driverProfile.update({
    where: { userId: driverId },
    data: { isApproved: true, documentsVerified: true },
  });

  return { message: 'Motorista aprovado com sucesso' };
}

/**
 * Bloqueia um usuário (motorista ou passageiro)
 */
export async function blockUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new AppError('Usuário não encontrado', 404);
  if (user.role === 'ADMIN') throw new AppError('Não é possível bloquear um administrador', 403);
  if (!user.isActive) throw new AppError('Usuário já está bloqueado', 400);

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  // Se for motorista, também coloca offline
  if (user.role === 'DRIVER') {
    await prisma.driverProfile.update({
      where: { userId },
      data: { isOnline: false },
    });
  }

  return { message: 'Usuário bloqueado com sucesso' };
}

/**
 * Histórico de alterações de preço
 */
export async function getPricingHistory(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.pricingConfig.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { name: true, email: true } } },
    }),
    prisma.pricingConfig.count(),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
