import { Router, raw } from 'express';
import * as paymentsController from './payments.controller';
import { authMiddleware } from '../../shared/middleware/auth.middleware';

const router = Router();

// ============================================================
// ROTAS PÚBLICAS (Webhooks e Páginas de Redirecionamento)
// Não requerem autenticação JWT pois são chamadas por serviços externos ou navegador
// ============================================================

/** Webhook do Stripe (requer raw Buffer) */
router.post(
  '/webhooks/stripe',
  raw({ type: 'application/json' }),
  paymentsController.stripeWebhook
);

/** Webhook oficial da InfinitePay (recebe POST JSON da CloudWalk quando o cliente paga) */
router.post('/webhooks/infinitepay', paymentsController.infinitePayWebhook);

/** Página de retorno / confirmação exibida após pagamento no checkout InfinitePay */
router.get('/infinitepay/redirect', paymentsController.renderRedirect);

/** Tela de checkout interativa para desenvolvimento, testes e contingência */
router.get('/infinitepay/demo-checkout', paymentsController.renderDemoCheckout);

// ============================================================
// ROTAS AUTENTICADAS (Usuários logados: Passageiros / Motoristas)
// ============================================================
router.use(authMiddleware);

/** Cria link de checkout InfinitePay para a corrida */
router.post('/infinitepay/checkout/:rideId', paymentsController.createInfinitePayCheckout);

/** Consulta status do pagamento e repasse automático de 88% */
router.get('/infinitepay/status/:rideId', paymentsController.getRidePaymentStatus);

/** Extrato de repasses (payouts de 88%) do motorista */
router.get('/driver/payouts', paymentsController.getDriverPayouts);

/** Reprocessa repasse de 88% caso tenha ficado pendente */
router.post('/driver/payouts/:rideId/retry', paymentsController.retryDriverPayout);

/** Processa pagamento tradicional de uma corrida específica */
router.post('/rides/:rideId', paymentsController.processPayment);

/** Histórico de pagamentos do usuário */
router.get('/history', paymentsController.getPaymentHistory);

export default router;
