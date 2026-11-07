import { Request, Response, NextFunction } from 'express';
import { getMessages, markMessagesAsRead } from './chat.service';
import { JwtPayload } from '../../shared/types';

// ============================================================
// Chat Controller — Endpoints REST para histórico de chat
// ============================================================

/**
 * GET /api/rides/:rideId/messages
 * Retorna o histórico de mensagens de uma corrida.
 */
export async function getMessagesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { rideId } = req.params;

    const messages = await getMessages(rideId, user.userId);

    // Marca como lidas ao buscar
    await markMessagesAsRead(rideId, user.userId);

    res.json({ messages });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
}
