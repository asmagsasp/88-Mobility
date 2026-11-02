import { Request, Response, NextFunction } from 'express';
import * as driversService from './drivers.service';
import { sendSuccess } from '../../shared/utils/response';

/** GET /drivers/profile */
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await driversService.getDriverProfile(req.user!.userId);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

/** PATCH /drivers/location */
export async function updateLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = req.body;
    await driversService.updateLocation(req.user!.userId, lat, lng);
    sendSuccess(res, { updated: true });
  } catch (err) {
    next(err);
  }
}

/** PATCH /drivers/status */
export async function setOnlineStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await driversService.setOnlineStatus(req.user!.userId, req.body.isOnline);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /drivers/earnings */
export async function getEarnings(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
    const earnings = await driversService.getEarnings(req.user!.userId, period);
    sendSuccess(res, earnings);
  } catch (err) {
    next(err);
  }
}

/** POST /drivers/documents */
export async function updateDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await driversService.updateDocuments(req.user!.userId, req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** POST /drivers/pix */
export async function updatePix(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await driversService.updatePix(req.user!.userId, req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
