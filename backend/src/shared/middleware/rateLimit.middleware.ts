import rateLimit from 'express-rate-limit';

/**
 * Middleware de Rate Limiting para rotas de autenticação (Login)
 * Bloqueia ataques de força bruta. Em ambiente de desenvolvimento/SQLite,
 * usa MemoryStore nativo sem dependência do Redis.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 20, // Máximo de 20 tentativas por IP dentro da janela
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login a partir deste IP. Tente novamente mais tarde.',
    });
  },
});

/**
 * Rate Limiting global para a API geral
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300, // 300 requisições por minuto
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Limite de requisições excedido. Diminua a frequência das chamadas.',
    });
  },
});
