/**
 * tenant.router.ts (Updated)
 * 
 * Tenant Router that dynamically mounts module routes from the registry.
 */

import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContextMiddleware } from '../middlewares/tenantContextMiddleware';
import { ModuleRegistry } from '../../application/platform/ModuleRegistry';
import { companyModuleGuard } from '../middlewares/guards/companyModuleGuard';
import { ownerOrPermissionGuard } from '../middlewares/guards/ownerOrPermissionGuard';

// Company Admin Routes
import companyAdminRouter from '../routes/company-admin.routes';

// Legacy routes (to be migrated to modules)
import rbacRoutes from '../routes/system.rbac.routes';
import companyModuleSettingsRoutes from '../routes/company.moduleSettings.routes';

const router = Router();

// Apply Auth & Tenant Context Middleware
router.use(authMiddleware);
router.use(tenantContextMiddleware);

// Mount Company Admin Routes
// Owner bypass: If user.isOwner === true, skip permission check
router.use(
  '/company-admin',
  ownerOrPermissionGuard('system.company.manage'),
  companyAdminRouter
);

// Dynamically mount module routes from registry
const registry = ModuleRegistry.getInstance();
const modules = registry.getAllModules();

for (const module of modules) {
    const moduleRouter = module.getRouter();
    router.use(`/${module.metadata.id}`, companyModuleGuard(module.metadata.id), moduleRouter);
    console.log(`Mounted module: ${module.metadata.id} at /${module.metadata.id}`);
}

router.use('/rbac', rbacRoutes);
router.use(companyModuleSettingsRoutes);

export default router;
