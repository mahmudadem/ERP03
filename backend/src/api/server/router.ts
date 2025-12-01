
/**
 * router.ts
 * Purpose: Aggregates all module routers into a single main router.
 */
import { Router } from 'express';
import coreRoutes from '../routes/core.routes';
import systemRoutes from '../routes/system.routes';
import accountingRoutes from '../routes/accounting.routes';
import inventoryRoutes from '../routes/inventory.routes';
import hrRoutes from '../routes/hr.routes';
import posRoutes from '../routes/pos.routes';
import designerRoutes from '../routes/designer.routes';
import rbacRoutes from '../routes/system.rbac.routes';
import superAdminRoutes from '../routes/super-admin.routes';
import companyWizardRoutes from '../routes/super-admin.company-wizard.routes';
import impersonationRoutes from '../routes/impersonation.routes';
import userCompaniesRoutes from '../routes/user.companies.routes';
import systemModuleSettingsRoutes from '../routes/system.moduleSettings.routes';
import companyModuleSettingsRoutes from '../routes/company.moduleSettings.routes';
import systemPermissionsRoutes from '../routes/system.permissions.routes';
import systemRolesRoutes from '../routes/system.roles.routes';
import authRoutes from '../routes/auth.routes';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Module Routes
// Auth first so it can't be shadowed and avoids any super-admin middleware ordering issues
router.use(authRoutes);
router.use('/core', coreRoutes);
router.use('/system', systemRoutes);
router.use('/rbac', rbacRoutes);
router.use('/company-wizard', companyWizardRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/impersonate', impersonationRoutes);
router.use(userCompaniesRoutes);
router.use(systemModuleSettingsRoutes);
router.use(companyModuleSettingsRoutes);
router.use(systemPermissionsRoutes);
router.use(systemRolesRoutes);
router.use('/accounting', accountingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/hr', hrRoutes);
router.use('/pos', posRoutes);
router.use('/designer', designerRoutes);

export default router;


