import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';
import { env } from '../../config/env';

/**
 * Classe de erro customizado com statusCode HTTP
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Middleware global de tratamento de erros.
 * Deve ser registrado como o ÚLTIMO middleware no Express.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Erro de validação do Zod
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Dados inválidos', 422, details);
    return;
  }

  // Erro customizado da aplicação
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.details);
    return;
  }

  // Erro genérico do Node/Prisma/etc
  if (err instanceof Error) {
    // Erros do Prisma
    if (err.message.includes('Unique constraint')) {
      sendError(res, 'Registro duplicado — este dado já existe no sistema', 409);
      return;
    }
    if (err.message.includes('Record to delete does not exist')) {
      sendError(res, 'Registro não encontrado', 404);
      return;
    }

    // Log do erro em desenvolvimento
    if (env.NODE_ENV === 'development') {
      console.error('❌ Erro não tratado:', err);
    }

    sendError(
      res,
      env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
      500
    );
    return;
  }

  // Fallback para erros desconhecidos
  sendError(res, 'Erro interno do servidor', 500);
}
