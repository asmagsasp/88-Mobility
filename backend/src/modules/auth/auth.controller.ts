import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess } from '../../shared/utils/response';

// ============================================================
// Auth Controller — Gerencia requisições HTTP de autenticação
// ============================================================

/**
 * POST /auth/register/passenger
 * Registra um novo passageiro
 */
export async function registerPassenger(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.registerPassenger(req.body);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/register/driver
 * Registra um novo motorista com perfil de veículo
 */
export async function registerDriver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.registerDriver(req.body);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 * Autentica usuário e retorna access + refresh tokens
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/refresh
 * Renova o access token usando o refresh token
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tokens = await authService.refreshToken(req.body.refreshToken);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/me
 * Retorna o perfil do usuário autenticado
 */
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await authService.getProfile(req.user!.userId);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}
