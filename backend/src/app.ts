import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { allowedOrigins } from './config/env';
import { errorMiddleware } from './shared/middleware/error.middleware';
import { apiRateLimiter } from './shared/middleware/rateLimit.middleware';

// Importa routers dos módulos
import authRouter from './modules/auth/auth.router';
import ridesRouter from './modules/rides/rides.router';
import driversRouter from './modules/drivers/drivers.router';
import paymentsRouter from './modules/payments/payments.router';
import adminRouter from './modules/admin/admin.router';

// ============================================================
// App Express — Configuração de middlewares e rotas
// ============================================================

const app = express();

// ============================================================
// Middlewares de segurança e parsing
// ============================================================

// Helmet adiciona headers de segurança HTTP
app.use(helmet());

// CORS configurado com origens permitidas do .env
app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requests sem origin (ex: mobile apps, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin não permitida pelo CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parse de JSON no body (exceto webhook do Stripe — tratado na rota)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhooks/stripe') {
    next(); // Stripe webhook precisa de raw body
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// ============================================================
// Health check — para Railway e load balancers
// ============================================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '88-mobility-api', timestamp: new Date().toISOString() });
});

// ============================================================
// Rotas da API (com proteção global de Rate Limiting)
// ============================================================
app.use('/api', apiRateLimiter);
app.use('/api/auth', authRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

// Rota 404 para endpoints não encontrados
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint não encontrado' });
});

// ============================================================
// Middleware global de erros (DEVE ser o último)
// ============================================================
app.use(errorMiddleware);

export default app;
