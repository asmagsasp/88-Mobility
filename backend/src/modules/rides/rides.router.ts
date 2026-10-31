import { Router } from 'express';
import * as ridesController from './rides.controller';
import { authMiddleware, requireDriver, requirePassenger } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  estimateRideSchema,
  requestRideSchema,
  completeRideSchema,
  cancelRideSchema,
} from './rides.dto';

const router = Router();

// Todas as rotas de corrida requerem autenticação
router.use(authMiddleware);

// ============================================================
// Rotas públicas para usuários autenticados
// ============================================================

/** Estima custo antes de solicitar — passageiros e motoristas podem consultar */
router.post('/estimate', validate(estimateRideSchema), ridesController.estimateRide);

/** Motoristas próximos de uma localização */
router.get('/nearby-drivers', ridesController.getNearbyDrivers);

/** Histórico de corridas do usuário autenticado */
router.get('/history', ridesController.getRideHistory);

/** Detalhes de uma corrida específica */
router.get('/:id', ridesController.getRideById);

// ============================================================
// Rotas de passageiro
// ============================================================

/** Solicita uma nova corrida */
router.post('/', requirePassenger, validate(requestRideSchema), ridesController.requestRide);

/** Passageiro cancela corrida */
router.patch('/:id/cancel', validate(cancelRideSchema), ridesController.cancelRide);

// ============================================================
// Rotas de motorista
// ============================================================

/** Motorista aceita corrida */
router.patch('/:id/accept', requireDriver, ridesController.acceptRide);

/** Motorista inicia corrida */
router.patch('/:id/start', requireDriver, ridesController.startRide);

/** Motorista finaliza corrida informando Km real */
router.patch(
  '/:id/complete',
  requireDriver,
  validate(completeRideSchema),
  ridesController.completeRide
);

export default router;
