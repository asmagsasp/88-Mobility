import { Router } from 'express';
import * as driversController from './drivers.controller';
import { authMiddleware, requireDriver } from '../../shared/middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../../shared/middleware/validate.middleware';

const router = Router();

// Todas as rotas de motorista requerem autenticação
router.use(authMiddleware, requireDriver);

/** Perfil do motorista logado */
router.get('/profile', driversController.getProfile);

/** Atualiza localização (pode ser chamado via HTTP ou Socket.io) */
router.patch(
  '/location',
  validate(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
  ),
  driversController.updateLocation
);

/** Fica online/offline */
router.patch(
  '/status',
  validate(z.object({ isOnline: z.boolean() })),
  driversController.setOnlineStatus
);

/** Ganhos do motorista por período */
router.get('/earnings', driversController.getEarnings);

export default router;
