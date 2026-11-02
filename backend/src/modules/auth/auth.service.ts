import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../shared/types/enums';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuthTokens, JwtPayload } from '../../shared/types';
import { RegisterPassengerDto, RegisterDriverDto, LoginDto } from './auth.dto';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 900s

// ============================================================
// Auth Service — Lógica de autenticação e autorização
// ============================================================

/**
 * Gera o par de tokens JWT (access + refresh)
 */
export function generateTokens(userId: string, role: UserRole): AuthTokens {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { userId, role };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  };
}

/**
 * Registra um novo passageiro
 */
export async function registerPassenger(dto: RegisterPassengerDto): Promise<{
  user: { id: string; name: string; email: string; role: UserRole };
  tokens: AuthTokens;
}> {
  // Verifica se email ou telefone já existem
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
  });

  if (existing) {
    const field = existing.email === dto.email ? 'Email' : 'Telefone';
    throw new AppError(`${field} já cadastrado`, 409);
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: UserRole.PASSENGER,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const role = user.role as UserRole;
  const tokens = generateTokens(user.id, role);
  return { user: { ...user, role }, tokens };
}

/**
 * Registra um novo motorista (usuário + perfil de motorista)
 */
export async function registerDriver(dto: RegisterDriverDto): Promise<{
  user: { id: string; name: string; email: string; role: UserRole };
  tokens: AuthTokens;
}> {
  // Verifica duplicatas
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
  });

  if (existing) {
    const field = existing.email === dto.email ? 'Email' : 'Telefone';
    throw new AppError(`${field} já cadastrado`, 409);
  }

  // Verifica se placa ou CNH já existem
  const existingDriver = await prisma.driverProfile.findFirst({
    where: {
      OR: [{ vehiclePlate: dto.vehiclePlate }, { licenseNumber: dto.licenseNumber }],
    },
  });

  if (existingDriver) {
    const field =
      existingDriver.vehiclePlate === dto.vehiclePlate ? 'Placa do veículo' : 'Número de CNH';
    throw new AppError(`${field} já cadastrado`, 409);
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  // Cria usuário e perfil de motorista em uma transação
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.DRIVER,
      },
    });

    await tx.driverProfile.create({
      data: {
        userId: newUser.id,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: new Date(dto.licenseExpiry),
        vehiclePlate: dto.vehiclePlate,
        vehicleModel: dto.vehicleModel,
        vehicleYear: dto.vehicleYear,
        vehicleColor: dto.vehicleColor,
      },
    });

    return newUser;
  });

  const role = user.role as UserRole;
  const tokens = generateTokens(user.id, role);
  return {
    user: { id: user.id, name: user.name, email: user.email, role },
    tokens,
  };
}

/**
 * Autentica um usuário com email e senha
 */
export async function login(dto: LoginDto): Promise<{
  user: { id: string; name: string; email: string; role: UserRole };
  tokens: AuthTokens;
}> {
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
  });

  if (!user) {
    throw new AppError('Email ou senha incorretos', 401);
  }

  if (!user.isActive) {
    throw new AppError('Conta desativada. Entre em contato com o suporte.', 403);
  }

  const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError('Email ou senha incorretos', 401);
  }

  const role = user.role as UserRole;
  const tokens = generateTokens(user.id, role);
  return {
    user: { id: user.id, name: user.name, email: user.email, role },
    tokens,
  };
}

/**
 * Valida o refresh token e retorna um novo access token
 */
export async function refreshToken(token: string): Promise<AuthTokens> {
  let payload: JwtPayload;

  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new AppError('Refresh token inválido ou expirado', 401);
  }

  // Verifica se o usuário ainda existe e está ativo
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new AppError('Usuário não encontrado ou desativado', 401);
  }

  return generateTokens(user.id, user.role as UserRole);
}

/**
 * Busca dados do perfil do usuário autenticado
 */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      rating: true,
      isVerified: true,
      createdAt: true,
      driverProfile: {
        select: {
          isApproved: true,
          isOnline: true,
          vehicleModel: true,
          vehiclePlate: true,
          vehicleColor: true,
          vehicleYear: true,
          totalKm: true,
          totalEarnings: true,
        },
      },
    },
  });

  if (!user) throw new AppError('Usuário não encontrado', 404);
  return user;
}
