import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Schema de validação de todas as variáveis de ambiente obrigatórias
const envSchema = z.object({
  // Servidor
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Banco de dados
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL é obrigatória' }).url(),

  // Redis
  REDIS_URL: z.string({ required_error: 'REDIS_URL é obrigatória' }),

  // JWT
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET é obrigatória' }).min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string({ required_error: 'JWT_REFRESH_SECRET é obrigatória' }).min(32),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string({ required_error: 'GOOGLE_MAPS_API_KEY é obrigatória' }),

  // Stripe
  STRIPE_SECRET_KEY: z.string({ required_error: 'STRIPE_SECRET_KEY é obrigatória' }),
  STRIPE_WEBHOOK_SECRET: z.string({ required_error: 'STRIPE_WEBHOOK_SECRET é obrigatória' }),

  // Mercado Pago
  MERCADO_PAGO_ACCESS_TOKEN: z.string({ required_error: 'MERCADO_PAGO_ACCESS_TOKEN é obrigatória' }),

  // Admin padrão
  ADMIN_EMAIL: z.string().email().default('admin@88mobility.com'),
  ADMIN_PASSWORD_HASH: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

// Tipo inferido do schema
export type Env = z.infer<typeof envSchema>;

// Valida e exporta as variáveis
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Erro de configuração — variáveis de ambiente inválidas:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const env = parseResult.data;

// Origens permitidas para o CORS (array)
export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
