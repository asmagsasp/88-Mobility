import { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import { sendSuccess } from '../../shared/utils/response';

/** POST /payments/rides/:rideId — Processa pagamento de uma corrida */
export async function processPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentsService.processPayment(req.params.rideId, req.user!.userId);
    sendSuccess(res, payment, 201);
  } catch (err) {
    next(err);
  }
}

/** POST /payments/webhooks/stripe — Webhook do Stripe */
export async function stripeWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const result = await paymentsService.handleStripeWebhook(
      req.body as Buffer,
      signature
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /payments/history — Histórico de pagamentos */
export async function getPaymentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await paymentsService.getPaymentHistory(req.user!.userId, page, limit);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
