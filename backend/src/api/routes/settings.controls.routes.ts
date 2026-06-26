/**
 * settings.controls.routes.ts — Company-wide Controls & Policies doorway.
 *
 * Task 267-D (Engine Management API Doorways): the company-wide controls
 * matrix page. Mounted at `/settings/controls` on the tenant router so the
 * final URL is `/tenant/settings/controls/policies`.
 *
 * Gated by `system.company.manage` (the existing owner-or-permission for
 * company-wide settings — see `ownerOrPermissionGuard`). Owners bypass
 * the permission check.
 */
import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { ownerOrPermissionGuard } from '../middlewares/guards/ownerOrPermissionGuard';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { PolicyConfigController } from '../controllers/system-core/PolicyConfigController';

const router = Router();
router.use(authMiddleware);
router.use(companyContextMiddleware);

router.get(
  '/policies',
  ownerOrPermissionGuard('system.company.manage'),
  PolicyConfigController.getPolicyConfig
);
router.put(
  '/policies',
  ownerOrPermissionGuard('system.company.manage'),
  PolicyConfigController.updatePolicyConfig
);

export default router;
