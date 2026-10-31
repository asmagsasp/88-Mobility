import { Router } from 'express';
import * as adminController from './admin.controller';
import { authMiddleware, requireAdmin } from '../../shared/middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../../shared/middleware/validate.middleware';

const router = Router();

// Todas as rotas de admin requerem autenticação + role ADMIN
router.use(authMiddleware, requireAdmin);

// ============================================================
// Pricing (preço por Km)
// ============================================================
router.get('/pricing', adminController.getPricingConfig);
router.get('/pricing/history', adminController.getPricingHistory);
router.put(
  '/pricing',
  validate(
    z.object({
      pricePerKm: z.number().positive('Preço por Km deve ser positivo'),
      driverSplit: z.number().min(0).max(1).default(0.88),
      platformSplit: z.number().min(0).max(1).default(0.12),
    })
  ),
  adminController.updatePricingConfig
);

// ============================================================
// Dashboard e estatísticas
// ============================================================
router.get('/dashboard', adminController.getDashboard);
router.get('/stats', adminController.getStats);

// ============================================================
// Gestão de motoristas
// ============================================================
router.get('/drivers', adminController.listDrivers);
router.patch('/drivers/:id/approve', adminController.approveDriver);

// ============================================================
// Gestão de usuários
// ============================================================
router.patch('/users/:id/block', adminController.blockUser);

export default router;
