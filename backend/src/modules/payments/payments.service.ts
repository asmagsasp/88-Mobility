import Stripe from 'stripe';
import { MercadoPagoConfig, Payment as MercadoPagoPayment } from 'mercadopago';
import { PaymentMethod, PaymentStatus } from '../../shared/types/enums';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../shared/middleware/error.middleware';

// Inicializa Stripe
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

// Inicializa Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});
const mpPayment = new MercadoPagoPayment(mpClient);

// ============================================================
// Payments Service — Integração com Stripe e Mercado Pago
// ============================================================

/**
 * Processa o pagamento de uma corrida de acordo com o método escolhido
 */
export async function processPayment(rideId: string, userId: string) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { passenger: { select: { email: true, name: true } } },
  });

  if (!ride) throw new AppError('Corrida não encontrada', 404);
  if (ride.passengerId !== userId) throw new AppError('Não autorizado', 403);
  if (ride.status !== 'COMPLETED') throw new AppError('Corrida não concluída', 409);
  if (ride.paymentStatus === 'PAID') throw new AppError('Corrida já foi paga', 409);

  const amount = ride.totalAmount ?? 0;

  let gatewayId: string | null = null;
  let gatewayResponse: unknown = null;

  // Pagamento em dinheiro — apenas registra
  if (ride.paymentMethod === PaymentMethod.CASH) {
    await prisma.ride.update({
      where: { id: rideId },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    return await prisma.payment.create({
      data: {
        rideId,
        userId,
        amount,
        method: PaymentMethod.CASH,
        status: PaymentStatus.PAID,
      },
    });
  }

  // PIX via Mercado Pago
  if (ride.paymentMethod === PaymentMethod.PIX) {
    try {
      const mpResult = await mpPayment.create({
        body: {
          transaction_amount: amount,
          payment_method_id: 'pix',
          payer: {
            email: ride.passenger.email,
            first_name: ride.passenger.name,
          },
          description: `88 Mobility - Corrida ${rideId}`,
          external_reference: rideId,
        },
      });

      gatewayId = String(mpResult.id);
      gatewayResponse = mpResult;
    } catch (err) {
      throw new AppError('Erro ao processar PIX. Tente novamente.', 502);
    }
  }

  // Cartão via Stripe (requer paymentMethodId do cliente)
  if (
    ride.paymentMethod === PaymentMethod.CREDIT_CARD ||
    ride.paymentMethod === PaymentMethod.DEBIT_CARD
  ) {
    // Em produção, o frontend envia o paymentMethodId do Stripe Elements
    // Por enquanto criamos um PaymentIntent para o cliente confirmar
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe usa centavos
        currency: 'brl',
        metadata: { rideId, userId },
        description: `88 Mobility - Corrida ${rideId}`,
      });

      gatewayId = paymentIntent.id;
      gatewayResponse = { clientSecret: paymentIntent.client_secret };
    } catch (err) {
      throw new AppError('Erro ao processar pagamento com cartão. Tente novamente.', 502);
    }
  }

  // Registra o pagamento no banco
  const payment = await prisma.payment.create({
    data: {
      rideId,
      userId,
      amount,
      method: ride.paymentMethod,
      status: PaymentStatus.PENDING,
      gatewayId,
      gatewayResponse: JSON.stringify(gatewayResponse),
    },
  });

  return payment;
}

/**
 * Webhook do Stripe — confirma pagamento após evento payment_intent.succeeded
 */
export async function handleStripeWebhook(payload: Buffer, signature: string) {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError('Assinatura do webhook inválida', 400);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const rideId = intent.metadata.rideId;

    if (rideId) {
      await Promise.all([
        prisma.payment.updateMany({
          where: { gatewayId: intent.id },
          data: { status: PaymentStatus.PAID },
        }),
        prisma.ride.update({
          where: { id: rideId },
          data: { paymentStatus: PaymentStatus.PAID },
        }),
      ]);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    await prisma.payment.updateMany({
      where: { gatewayId: intent.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  return { received: true };
}

/**
 * Retorna histórico de pagamentos de um usuário
 */
export async function getPaymentHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        ride: {
          select: {
            originAddress: true,
            destinationAddress: true,
            actualKm: true,
            completedAt: true,
          },
        },
      },
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
}
