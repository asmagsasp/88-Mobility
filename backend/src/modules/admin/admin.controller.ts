import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';
import { sendSuccess } from '../../shared/utils/response';

// ============================================================
// Admin Controller — Endpoints de gestão da plataforma
// ============================================================

/** GET /admin/pricing */
export async function getPricingConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await adminService.getPricingConfig();
    sendSuccess(res, config);
  } catch (err) {
    next(err);
  }
}

/** PUT /admin/pricing */
export async function updatePricingConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { pricePerKm, driverSplit, platformSplit } = req.body;
    const adminId = req.user!.userId;
    const config = await adminService.updatePricingConfig(
      pricePerKm,
      adminId,
      driverSplit,
      platformSplit
    );
    sendSuccess(res, config);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/pricing/history */
export async function getPricingHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const history = await adminService.getPricingHistory(page, limit);
    sendSuccess(res, history);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/dashboard */
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getDashboardData();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/stats */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await adminService.getStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/drivers */
export async function listDrivers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {
      isApproved:
        req.query.isApproved !== undefined ? req.query.isApproved === 'true' : undefined,
      isOnline: req.query.isOnline !== undefined ? req.query.isOnline === 'true' : undefined,
      search: req.query.search as string | undefined,
    };
    const result = await adminService.listDrivers(page, limit, filter);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/drivers/:id/approve */
export async function approveDriver(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.approveDriver(req.params.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/users/:id/block */
export async function blockUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.blockUser(req.params.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
