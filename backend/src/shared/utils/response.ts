import { Response } from 'express';

// ============================================================
// Helpers para padronizar respostas da API
// Formato: { success: boolean, data?: T, error?: string, meta?: object }
// ============================================================

/**
 * Resposta de sucesso
 * @param res - Response do Express
 * @param data - Dados a retornar
 * @param statusCode - HTTP status (padrão: 200)
 * @param meta - Metadados opcionais (ex: paginação)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

/**
 * Resposta de erro
 * @param res - Response do Express
 * @param message - Mensagem de erro legível
 * @param statusCode - HTTP status (padrão: 400)
 * @param details - Detalhes extras do erro (ex: erros de validação)
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

/**
 * Resposta de recurso não encontrado
 */
export function sendNotFound(res: Response, resource = 'Recurso'): Response {
  return sendError(res, `${resource} não encontrado`, 404);
}

/**
 * Resposta de não autorizado
 */
export function sendUnauthorized(res: Response, message = 'Não autorizado'): Response {
  return sendError(res, message, 401);
}

/**
 * Resposta de acesso proibido
 */
export function sendForbidden(res: Response, message = 'Acesso negado'): Response {
  return sendError(res, message, 403);
}
