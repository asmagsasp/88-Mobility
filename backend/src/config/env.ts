import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Schema de validação das variáveis de ambiente com defaults seguros para desenvolvimento local (SQLite)
const envSchema = z.object({
  // Servidor
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Banco de dados: SQLite local por padrão (dev.db)
  DATABASE_URL: z.string().default('file:./dev.db'),

  // Redis (opcional — usa fallback em memória quando ausente)
  REDIS_URL: z.string().optional().default(''),

  // JWT
  JWT_SECRET: z
    .string()
    .default('88mobility_super_secret_jwt_key_2026_dev_min32chars!'),
  JWT_REFRESH_SECRET: z
    .string()
    .default('88mobility_super_refresh_jwt_key_2026_dev_min32!'),

  // Google Maps (opcional — fallback para Haversine e OSRM)
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),

  // Stripe (opcional em dev)
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),

  // Mercado Pago (opcional em dev)
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional().default(''),

  // Admin padrão
  ADMIN_EMAIL: z.string().email().default('admin@88mobility.com'),
  ADMIN_PASSWORD_HASH: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:19006,*'),
});

export type Env = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Erro de configuração — variáveis de ambiente inválidas:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const env = parseResult.data;

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
