import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

/**
 * Middleware de validação com Zod.
 * Valida o body da requisição contra um schema Zod.
 * Em caso de erro, retorna 422 com os detalhes dos campos inválidos.
 *
 * @param schema - Schema Zod a ser usado para validação
 *
 * @example
 * router.post('/login', validate(loginSchema), authController.login)
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendError(res, 'Dados de entrada inválidos', 422, details);
        return;
      }
      next(err);
    }
  };
}

/**
 * Middleware de validação de query params com Zod.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendError(res, 'Parâmetros de query inválidos', 422, details);
        return;
      }
      next(err);
    }
  };
}
