import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { authRateLimiter } from '../../shared/middleware/rateLimit.middleware';
import {
  registerPassengerSchema,
  registerDriverSchema,
  loginSchema,
  refreshTokenSchema,
} from './auth.dto';

const router = Router();

// ============================================================
// Rotas públicas (sem autenticação)
// ============================================================

/** Registra um novo passageiro */
router.post(
  '/register/passenger',
  validate(registerPassengerSchema),
  authController.registerPassenger
);

/** Registra um novo motorista */
router.post(
  '/register/driver',
  validate(registerDriverSchema),
  authController.registerDriver
);

/** Login protegido contra ataques de força bruta (máx 5 tentativas / 15 min) */
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);

/** Renova o access token */
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// ============================================================
// Rotas protegidas (requerem autenticação)
// ============================================================

/** Retorna perfil do usuário logado */
router.get('/me', authMiddleware, authController.getProfile);

export default router;
