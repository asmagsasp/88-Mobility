import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtPayload } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { UserRole } from '@prisma/client';

/**
 * Middleware de autenticação JWT.
 * Extrai e valida o Bearer token do header Authorization.
 * Adiciona `req.user` com { userId, role } se válido.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendUnauthorized(res, 'Token de autenticação não fornecido');
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, 'Token expirado');
    } else {
      sendUnauthorized(res, 'Token inválido');
    }
  }
}

/**
 * Factory de middleware para verificar roles específicas.
 * Deve ser usado APÓS o authMiddleware.
 *
 * @example
 * router.get('/admin', authMiddleware, requireRole('ADMIN'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendForbidden(res, `Acesso restrito para: ${roles.join(', ')}`);
      return;
    }

    next();
  };
}

// Atalhos para uso frequente
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireDriver = requireRole(UserRole.DRIVER);
export const requirePassenger = requireRole(UserRole.PASSENGER);
export const requireDriverOrPassenger = requireRole(UserRole.DRIVER, UserRole.PASSENGER);
