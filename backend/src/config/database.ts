import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Singleton do Prisma Client
// Em desenvolvimento, reutilizamos a instância para evitar conexões excessivas
// com hot-reload (ts-node-dev)

declare global {
  // Evita múltiplas instâncias em desenvolvimento (hot-reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Garante que a conexão seja fechada quando o processo terminar
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
