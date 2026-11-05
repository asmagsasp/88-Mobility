import axios from 'axios';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../shared/middleware/error.middleware';
import { PaymentStatus } from '../../shared/types/enums';
import { executeDriverPayout } from './payout.service';

const SYNC_URL = 'https://ntfy.sh/88mobility_live_rides_sync';

export interface InfinitePayCheckoutResponse {
  checkoutUrl: string;
  rideId: string;
  totalAmount: number;
  driverAmount: number;   // 88%
  platformAmount: number; // 12%
  orderNsu: string;
  isSandbox: boolean;
}

/**
 * Cria sessão de pagamento no Checkout da InfinitePay para uma corrida
 */
export async function createInfinitePayCheckout(
  rideId: string,
  userId: string
): Promise<InfinitePayCheckoutResponse> {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      passenger: { select: { id: true, name: true, email: true, phone: true } },
      driver: {
        select: {
          id: true,
          name: true,
          driverProfile: { select: { pixKey: true, pixKeyType: true } },
        },
      },
    },
  });

  if (!ride) throw new AppError('Corrida não encontrada', 404);
  if (ride.passengerId !== userId && ride.driverId !== userId) {
    throw new AppError('Não autorizado para gerar cobrança desta corrida', 403);
  }

  // Define o valor total da corrida
  const totalAmount = ride.totalAmount && ride.totalAmount > 0
    ? ride.totalAmount
    : (ride.pricePerKm * (ride.estimatedKm || 5) + (ride.platformFee || 2.0));

  const driverAmount = ride.driverAmount && ride.driverAmount > 0
    ? ride.driverAmount
    : Math.round(totalAmount * 0.88 * 100) / 100;

  const platformAmount = Math.round((totalAmount - driverAmount) * 100) / 100;
  const amountInCents = Math.round(totalAmount * 100);
  const orderNsu = ride.id;

  let checkoutUrl = '';
  let isSandbox = false;

  // Se tiver chave de API da InfinitePay configurada, chama o endpoint oficial
  if (env.INFINITEPAY_API_KEY && env.INFINITEPAY_API_KEY.trim() !== '') {
    try {
      const payload: Record<string, any> = {
        order_nsu: orderNsu,
        webhook_url: `${env.BACKEND_PUBLIC_URL}/api/payments/webhooks/infinitepay`,
        redirect_url: `${env.BACKEND_PUBLIC_URL}/api/payments/infinitepay/redirect?rideId=${rideId}`,
        items: [
          {
            description: `88 Mobility - Corrida #${rideId.slice(0, 8)}`,
            quantity: 1,
            price: amountInCents,
          },
        ],
      };

      if (env.INFINITEPAY_HANDLE) {
        payload.handle = env.INFINITEPAY_HANDLE;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Api-Key': env.INFINITEPAY_API_KEY,
      };

      console.log(`🌐 [InfinitePay API] Enviando requisição para ${env.INFINITEPAY_BASE_URL}/links...`);
      const response = await axios.post(`${env.INFINITEPAY_BASE_URL}/links`, payload, {
        headers,
        timeout: 10000,
      });

      if (response.data && response.data.url) {
        checkoutUrl = response.data.url;
      } else {
        throw new Error('InfinitePay não retornou URL de pagamento válida');
      }
    } catch (err: any) {
      console.warn('⚠️ [InfinitePay] Falha na chamada da API oficial, gerando checkout de contingência:', err?.response?.data || err?.message);
      // Fallback para URL de checkout de demonstração / contingência
      checkoutUrl = `${env.BACKEND_PUBLIC_URL}/api/payments/infinitepay/demo-checkout?rideId=${rideId}`;
      isSandbox = true;
    }
  } else {
    // Modo sandbox / desenvolvimento sem chave cadastrada ainda
    console.log(`ℹ️ [InfinitePay] Chave API não configurada no .env. Usando checkout de teste local.`);
    checkoutUrl = `${env.BACKEND_PUBLIC_URL}/api/payments/infinitepay/demo-checkout?rideId=${rideId}`;
    isSandbox = true;
  }

  // Registra ou atualiza o registro de Payment no banco de dados
  await prisma.payment.upsert({
    where: { rideId },
    update: {
      amount: totalAmount,
      method: 'INFINITEPAY_PIX',
      status: PaymentStatus.PENDING,
      gateway: 'INFINITEPAY',
      gatewayId: orderNsu,
      checkoutUrl,
      orderNsu,
      driverShare: driverAmount,
      platformFee: platformAmount,
    },
    create: {
      rideId,
      userId: ride.passengerId,
      amount: totalAmount,
      method: 'INFINITEPAY_PIX',
      status: PaymentStatus.PENDING,
      gateway: 'INFINITEPAY',
      gatewayId: orderNsu,
      checkoutUrl,
      orderNsu,
      driverShare: driverAmount,
      platformFee: platformAmount,
    },
  });

  return {
    checkoutUrl,
    rideId,
    totalAmount,
    driverAmount,
    platformAmount,
    orderNsu,
    isSandbox,
  };
}

/**
 * Processa o Webhook recebido da InfinitePay após pagamento do cliente
 */
export async function handleInfinitePayWebhook(body: any) {
  console.log('\n📥 [Webhook InfinitePay] Notificação recebida:');
  console.log(JSON.stringify(body, null, 2));

  // A InfinitePay envia { event: "paid", order_nsu: "...", amount: 2500, capture_method: "pix" }
  const isPaid =
    body.event === 'paid' ||
    body.status === 'paid' ||
    body.paid === true ||
    body.transaction_status === 'approved';

  const orderNsu = body.order_nsu || body.orderNsu || body.external_reference;
  const transactionNsu = body.transaction_nsu || body.transactionId || body.invoice_slug;
  const captureMethod = body.capture_method || 'pix';
  const paidAmount = body.paid_amount ? body.paid_amount / 100 : (body.amount ? body.amount / 100 : undefined);

  if (!orderNsu) {
    console.warn('⚠️ [Webhook InfinitePay] order_nsu não informado na requisição');
    return { received: true, processed: false, reason: 'order_nsu_missing' };
  }

  // Localiza a corrida pelo order_nsu (que é o rideId)
  const ride = await prisma.ride.findUnique({
    where: { id: orderNsu },
    include: {
      passenger: { select: { id: true, name: true, phone: true } },
      driver: {
        include: {
          driverProfile: true,
        },
      },
    },
  });

  if (!ride) {
    console.warn(`⚠️ [Webhook InfinitePay] Corrida com ID/NSU #${orderNsu} não encontrada`);
    return { received: true, processed: false, reason: 'ride_not_found' };
  }

  if (isPaid) {
    console.log(`🎉 [InfinitePay] Pagamento da corrida #${ride.id} CONFIRMADO via ${captureMethod.toUpperCase()}!`);

    // 1. Atualiza status de pagamento da corrida e registro de Payment
    await Promise.all([
      prisma.ride.update({
        where: { id: ride.id },
        data: { paymentStatus: PaymentStatus.PAID },
      }),
      prisma.payment.upsert({
        where: { rideId: ride.id },
        update: {
          status: PaymentStatus.PAID,
          transactionNsu: transactionNsu ? String(transactionNsu) : undefined,
          captureMethod,
          amount: paidAmount || ride.totalAmount || 0,
          gatewayResponse: JSON.stringify(body),
        },
        create: {
          rideId: ride.id,
          userId: ride.passengerId,
          amount: paidAmount || ride.totalAmount || 0,
          method: 'INFINITEPAY_PIX',
          status: PaymentStatus.PAID,
          gateway: 'INFINITEPAY',
          transactionNsu: transactionNsu ? String(transactionNsu) : undefined,
          captureMethod,
          orderNsu,
          gatewayResponse: JSON.stringify(body),
        },
      }),
    ]);

    // 2. DISPARA AUTOMATICAMENTE O REPASSE DE 88% PARA A CHAVE PIX DO MOTORISTA
    let payoutResult = null;
    try {
      payoutResult = await executeDriverPayout(ride.id);
    } catch (payoutErr: any) {
      console.error('❌ [InfinitePay] Erro no repasse automático de 88%:', payoutErr?.message);
    }

    // 3. Notifica ambos os apps em tempo real via ntfy.sh
    try {
      await fetch(SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Title: 'PAYMENT_CONFIRMED',
        },
        body: JSON.stringify({
          type: 'PAYMENT_CONFIRMED',
          rideId: ride.id,
          status: 'PAID',
          captureMethod,
          totalAmount: ride.totalAmount,
          driverAmount: ride.driverAmount,
          payout: payoutResult,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (syncErr) {
      console.warn('[Sync] Falha ao notificar pagamento:', syncErr);
    }

    return {
      received: true,
      processed: true,
      rideId: ride.id,
      paymentStatus: 'PAID',
      payout: payoutResult,
    };
  }

  return { received: true, processed: false, reason: 'unhandled_event' };
}

/**
 * Consulta o status atual do pagamento e repasse de uma corrida
 */
export async function getRidePaymentStatus(rideId: string) {
  const [ride, payment, payout] = await Promise.all([
    prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        driverAmount: true,
        platformAmount: true,
        driverId: true,
        passengerId: true,
      },
    }),
    prisma.payment.findUnique({
      where: { rideId },
    }),
    prisma.driverPayout.findUnique({
      where: { rideId },
    }),
  ]);

  if (!ride) throw new AppError('Corrida não encontrada', 404);

  return {
    rideId,
    rideStatus: ride.status,
    paymentStatus: ride.paymentStatus,
    totalAmount: ride.totalAmount,
    driverAmount: ride.driverAmount,
    platformAmount: ride.platformAmount,
    payment: payment
      ? {
          status: payment.status,
          gateway: payment.gateway,
          checkoutUrl: payment.checkoutUrl,
          captureMethod: payment.captureMethod,
          createdAt: payment.createdAt,
        }
      : null,
    payout: payout
      ? {
          status: payout.status,
          amount: payout.amount,
          pixKey: payout.pixKey,
          pixKeyType: payout.pixKeyType,
          transactionId: payout.transactionId,
          processedAt: payout.processedAt,
        }
      : null,
  };
}
