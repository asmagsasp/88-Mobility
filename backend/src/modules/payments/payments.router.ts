import { Router, raw } from 'express';
import * as paymentsController from './payments.controller';
import { authMiddleware } from '../../shared/middleware/auth.middleware';

const router = Router();

// ============================================================
// Webhook do Stripe — DEVE vir ANTES do json() middleware
// O corpo precisa ser raw Buffer para verificação da assinatura
// ============================================================
router.post(
  '/webhooks/stripe',
  raw({ type: 'application/json' }),
  paymentsController.stripeWebhook
);

// As demais rotas requerem autenticação
router.use(authMiddleware);

/** Processa pagamento de uma corrida específica */
router.post('/rides/:rideId', paymentsController.processPayment);

/** Histórico de pagamentos do usuário */
router.get('/history', paymentsController.getPaymentHistory);

export default router;
