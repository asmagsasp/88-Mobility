import http from 'http';
import app from './app';
import { initSocket } from './socket';
import { env } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';

// ============================================================
// Entry Point — Inicializa servidor HTTP + Socket.io
// ============================================================

async function bootstrap() {
  // Testa conexão com o banco de dados SQLite
  try {
    await prisma.$connect();
    console.log('✅ SQLite conectado (dev.db)');
  } catch (err) {
    console.error('❌ Falha ao conectar ao banco SQLite:', err);
    process.exit(1);
  }

  // O Redis conecta automaticamente via ioredis (ver config/redis.ts)

  // Cria servidor HTTP a partir do app Express
  const httpServer = http.createServer(app);

  // Inicializa Socket.io no mesmo servidor HTTP
  const io = initSocket(httpServer);

  // Torna o io disponível globalmente para uso nos serviços
  app.set('io', io);

  // Inicia o servidor
  httpServer.listen(env.PORT, () => {
    console.log(`
🚀 88 Mobility API rodando!
   - HTTP:      http://localhost:${env.PORT}
   - Ambiente:  ${env.NODE_ENV}
   - Health:    http://localhost:${env.PORT}/health
    `);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n⚠️  Recebido ${signal}. Encerrando graciosamente...`);

    httpServer.close(async () => {
      await prisma.$disconnect();
      await redis.quit();
      console.log('✅ Servidor encerrado');
      process.exit(0);
    });

    // Força encerramento após 10 segundos
    setTimeout(() => {
      console.error('❌ Timeout de shutdown — forçando encerramento');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Trata exceções não capturadas
  process.on('uncaughtException', (err) => {
    console.error('❌ Exceção não capturada:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
    process.exit(1);
  });
}

bootstrap();
