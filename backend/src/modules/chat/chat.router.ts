import { Router } from 'express';
import { getMessagesHandler } from './chat.controller';
import { authMiddleware } from '../../shared/middleware/auth.middleware';

// ============================================================
// Chat Router — Endpoints REST para o bate-papo
// ============================================================
const chatRouter = Router();

/**
 * GET /api/rides/:rideId/messages
 * Retorna o historico de mensagens de uma corrida.
 * Apenas passageiro ou motorista da corrida pode acessar.
 */
chatRouter.get('/rides/:rideId/messages', authMiddleware, getMessagesHandler);

export default chatRouter;
