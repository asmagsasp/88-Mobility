import { Request, Response, NextFunction } from 'express';
import * as ridesService from './rides.service';
import { sendSuccess } from '../../shared/utils/response';

// ============================================================
// Rides Controller — Endpoints de corridas
// ============================================================

/** POST /rides/estimate — Estima custo de corrida */
export async function estimateRide(req: Request, res: Response, next: NextFunction) {
  try {
    const estimate = await ridesService.estimateRide(req.body);
    sendSuccess(res, estimate);
  } catch (err) {
    next(err);
  }
}

/** POST /rides — Solicita uma nova corrida */
export async function requestRide(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ridesService.requestRide(req.user!.userId, req.body);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/** GET /rides/nearby-drivers — Motoristas próximos */
export async function getNearbyDrivers(req: Request, res: Response, next: NextFunction) {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    const drivers = await ridesService.getNearbyDrivers(lat, lng, radius);
    sendSuccess(res, drivers);
  } catch (err) {
    next(err);
  }
}

/** GET /rides/history — Histórico de corridas */
export async function getRideHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await ridesService.getRideHistory(req.user!.userId, page, limit);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /rides/:id — Detalhes de uma corrida */
export async function getRideById(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await ridesService.getRideById(req.user!.userId, req.params.id);
    sendSuccess(res, ride);
  } catch (err) {
    next(err);
  }
}

/** PATCH /rides/:id/accept — Motorista aceita corrida */
export async function acceptRide(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await ridesService.acceptRide(req.user!.userId, req.params.id);
    sendSuccess(res, ride);
  } catch (err) {
    next(err);
  }
}

/** PATCH /rides/:id/start — Motorista inicia corrida */
export async function startRide(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await ridesService.startRide(req.user!.userId, req.params.id);
    sendSuccess(res, ride);
  } catch (err) {
    next(err);
  }
}

/** PATCH /rides/:id/complete — Motorista finaliza corrida */
export async function completeRide(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ridesService.completeRide(
      req.user!.userId,
      req.params.id,
      req.body.actualKm
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /rides/:id/cancel — Cancela corrida */
export async function cancelRide(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await ridesService.cancelRide(
      req.user!.userId,
      req.params.id,
      req.body.reason
    );
    sendSuccess(res, ride);
  } catch (err) {
    next(err);
  }
}

/** POST /rides/sync/events — Publica evento de corrida no banco SQLite */
export async function publishSyncEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { rideId, type, payload } = req.body;
    const event = await ridesService.publishSyncEvent(rideId || 'global', type, payload || req.body);
    sendSuccess(res, event, 201);
  } catch (err) {
    next(err);
  }
}

/** GET /rides/sync/events — Consulta eventos recentes de corridas no banco SQLite */
export async function getSyncEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const sinceParam = req.query.since as string;
    const since = sinceParam ? new Date(isNaN(Number(sinceParam)) ? sinceParam : Number(sinceParam) * 1000) : undefined;
    const events = await ridesService.getSyncEvents(since);
    sendSuccess(res, events);
  } catch (err) {
    next(err);
  }
}
