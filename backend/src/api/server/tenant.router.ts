/**
 * tenant.router.ts (Updated)
 * 
 * Tenant Router that dynamically mounts module routes from the registry.
 */

import { Router } from 'express';
import { tenantContextMiddleware } from '../middlewares/tenantContextMiddleware';
import { ModuleRegistry } from '../../application/platform/ModuleRegistry';

const router = Router();

// Apply Tenant Context Middleware
router.use(tenantContextMiddleware);

// Dynamically mount module routes from registry
const registry = ModuleRegistry.getInstance();
const modules = registry.getAllModules();

for (const module of modules) {
    const moduleRouter = module.getRouter();
    router.use(`/${module.metadata.id}`, moduleRouter);
    console.log(`Mounted module: ${module.metadata.id} at /${module.metadata.id}`);
}

// Legacy routes (to be migrated to modules)
import rbacRoutes from '../routes/system.rbac.routes';
import companyModuleSettingsRoutes from '../routes/company.moduleSettings.routes';

router.use('/rbac', rbacRoutes);
router.use(companyModuleSettingsRoutes);

export default router;
