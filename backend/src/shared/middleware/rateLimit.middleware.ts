import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../../config/redis';

/**
 * Middleware de Rate Limiting para rotas de autenticação (Login)
 * Bloqueia ataques automatizados de força bruta e credential stuffing.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 5, // Máximo de 5 tentativas por IP dentro da janela
  standardHeaders: true, // Retorna RateLimit-* headers no padrão IETF
  legacyHeaders: false, // Desabilita headers antigos X-RateLimit-*
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login a partir deste IP. Bloqueio temporário de 15 minutos por segurança.',
    });
  },
  store: new RedisStore({
    // @ts-expect-error Redis client compatible sendCommand
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:auth:',
  }),
});

/**
 * Rate Limiting global mais brando para a API geral (ex: 100 requisições por minuto)
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Limite de requisições excedido. Diminua a frequência das chamadas.',
    });
  },
  store: new RedisStore({
    // @ts-expect-error Redis client compatible sendCommand
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:api:',
  }),
});
