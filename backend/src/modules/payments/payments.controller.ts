import { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import * as infinitePayService from './infinitepay.service';
import * as payoutService from './payout.service';
import { sendSuccess } from '../../shared/utils/response';

/** POST /payments/infinitepay/checkout/:rideId — Cria link de checkout InfinitePay */
export async function createInfinitePayCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await infinitePayService.createInfinitePayCheckout(
      req.params.rideId,
      req.user!.userId
    );
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/** POST /payments/webhooks/infinitepay — Webhook oficial da InfinitePay */
export async function infinitePayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await infinitePayService.handleInfinitePayWebhook(req.body);
    // Sempre retorna 200 OK para a InfinitePay
    res.status(200).json(result);
  } catch (err) {
    console.error('❌ Erro no webhook InfinitePay:', err);
    res.status(200).json({ received: true, error: (err as any)?.message });
  }
}

/** GET /payments/infinitepay/status/:rideId — Status do pagamento e repasse de 88% */
export async function getRidePaymentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await infinitePayService.getRidePaymentStatus(req.params.rideId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /payments/driver/payouts — Histórico de repasses do motorista */
export async function getDriverPayouts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await payoutService.getDriverPayouts(req.user!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** POST /payments/driver/payouts/:rideId/retry — Reprocessa repasse de 88% pendente */
export async function retryDriverPayout(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await payoutService.executeDriverPayout(req.params.rideId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /payments/infinitepay/redirect — Página de retorno após pagamento no checkout */
export async function renderRedirect(req: Request, res: Response) {
  const rideId = req.query.rideId as string;
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento Confirmado - 88 Mobility</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #F8FAFC; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1E293B; border-radius: 16px; padding: 32px; max-width: 400px; text-align: center; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
        .icon { font-size: 56px; margin-bottom: 16px; }
        h1 { color: #10B981; margin: 0 0 12px; font-size: 24px; }
        p { color: #94A3B8; font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
        .badge { background: #064E3B; color: #34D399; padding: 6px 14px; border-radius: 9999px; font-weight: 600; font-size: 13px; display: inline-block; margin-bottom: 20px; }
        .btn { display: block; background: #EAB308; color: #0F172A; text-decoration: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 16px; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✅</div>
        <div class="badge">InfinitePay Checkout</div>
        <h1>Pagamento Recebido!</h1>
        <p>Seu pagamento da corrida foi processado com sucesso.<br>O repasse de 88% ao motorista parceiro já foi emitido.</p>
        <a class="btn" href="javascript:window.close();">Voltar ao Aplicativo</a>
      </div>
    </body>
    </html>
  `);
}

/** GET /payments/infinitepay/demo-checkout — Checkout interativo para testes e contingência */
export async function renderDemoCheckout(req: Request, res: Response) {
  const rideId = req.query.rideId as string;
  try {
    const status = await infinitePayService.getRidePaymentStatus(rideId);
    const totalAmount = status.totalAmount?.toFixed(2) || '15.00';
    const driverAmount = status.driverAmount?.toFixed(2) || (Number(totalAmount) * 0.88).toFixed(2);
    const platformAmount = status.platformAmount?.toFixed(2) || (Number(totalAmount) * 0.12).toFixed(2);

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>InfinitePay Checkout - 88 Mobility</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090D16; color: #F8FAFC; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .container { background: #131B2E; border-radius: 20px; padding: 28px; max-width: 440px; width: 100%; border: 1px solid #1E293B; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1E293B; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 20px; font-weight: 800; color: #EAB308; }
          .powered { font-size: 12px; color: #64748B; }
          .tag { background: #0284C7; color: #E0F2FE; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 600; }
          .amount-box { background: #0F172A; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 20px; border: 1px solid #1E293B; }
          .amount-label { font-size: 13px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; }
          .amount-val { font-size: 34px; font-weight: 800; color: #F8FAFC; margin-top: 6px; }
          .split-box { background: #0D1424; border-radius: 10px; padding: 14px; margin-bottom: 20px; font-size: 13px; border: 1px dashed #334155; }
          .split-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .split-row:last-child { margin-bottom: 0; }
          .split-driver { color: #10B981; font-weight: 700; }
          .split-platform { color: #EAB308; font-weight: 700; }
          .pix-qr { width: 180px; height: 180px; margin: 0 auto 16px; background: #FFFFFF; border-radius: 12px; padding: 10px; display: flex; align-items: center; justify-content: center; }
          .pix-qr img { width: 100%; height: 100%; border-radius: 6px; }
          .btn-pay { background: #10B981; color: #FFFFFF; border: none; border-radius: 12px; padding: 16px; width: 100%; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform 0.1s, opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
          .btn-pay:hover { opacity: 0.95; transform: scale(1.01); }
          .status { font-size: 12px; text-align: center; color: #64748B; margin-top: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div class="brand">88 Mobility</div>
              <div class="powered">Checkout InfinitePay</div>
            </div>
            <span class="tag">PIX Dinâmico</span>
          </div>

          <div class="amount-box">
            <div class="amount-label">Valor da Corrida</div>
            <div class="amount-val">R$ ${totalAmount}</div>
          </div>

          <div class="split-box">
            <div class="split-row">
              <span style="color: #94A3B8;">Repasse ao Motorista (88% via Pix):</span>
              <span class="split-driver">R$ ${driverAmount}</span>
            </div>
            <div class="split-row">
              <span style="color: #94A3B8;">Taxa da Plataforma (12% retido):</span>
              <span class="split-platform">R$ ${platformAmount}</span>
            </div>
          </div>

          <div class="pix-qr">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=88mobility-infinitepay-ride-${rideId}" alt="QR Code Pix" />
          </div>

          <button class="btn-pay" onclick="simularPagamento()">
            ⚡ Pagar R$ ${totalAmount} com PIX
          </button>

          <div class="status" id="status-txt">
            Após o pagamento, os 88% são transferidos automaticamente para a chave Pix do motorista.
          </div>
        </div>

        <script>
          async function simularPagamento() {
            const btn = document.querySelector('.btn-pay');
            const txt = document.getElementById('status-txt');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.innerText = 'Processando na InfinitePay...';

            try {
              const res = await fetch('/api/payments/webhooks/infinitepay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'paid',
                  order_nsu: '${rideId}',
                  transaction_nsu: 'tx_infinite_' + Date.now(),
                  amount: Math.round(Number('${totalAmount}') * 100),
                  paid_amount: Math.round(Number('${totalAmount}') * 100),
                  capture_method: 'pix',
                  receipt_url: 'https://pay.infinitepay.io/receipt/demo'
                })
              });
              const data = await res.json();
              if (data.processed) {
                txt.innerHTML = '<span style="color: #10B981; font-weight: 700;">✅ Pagamento confirmado! 88% transferido para a chave Pix do motorista.</span>';
                btn.style.background = '#10B981';
                btn.innerText = '✅ Pago com Sucesso!';
                setTimeout(() => {
                  window.location.href = '/api/payments/infinitepay/redirect?rideId=${rideId}';
                }, 1500);
              }
            } catch (e) {
              txt.innerText = 'Erro ao processar: ' + e.message;
              btn.disabled = false;
              btn.style.opacity = '1';
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(404).send(`<h3>Corrida não encontrada ou erro: ${err?.message}</h3>`);
  }
}

/** POST /payments/rides/:rideId — Processa pagamento legado */
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
