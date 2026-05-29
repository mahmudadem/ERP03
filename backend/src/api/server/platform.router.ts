import { Router } from 'express';
import superAdminRoutes from '../routes/super-admin.routes';
import superAdminTemplatesRoutes from '../routes/super-admin.templates.routes';
import superAdminVoucherTypesRoutes from '../routes/super-admin.voucher-types.routes';
import systemPermissionsRoutes from '../routes/system.permissions.routes';
import systemRolesRoutes from '../routes/system.roles.routes';
import systemModuleSettingsRoutes from '../routes/system.moduleSettings.routes';
import systemRoutes from '../routes/system.routes';
import aiToolCatalogRoutes from '../routes/ai-tool-catalog.routes';
import aiProposalPolicyRoutes from '../routes/ai-proposal-policies.routes';

const router = Router();

router.use('/super-admin', superAdminRoutes);
router.use('/super-admin/templates', superAdminTemplatesRoutes);
router.use('/super-admin/voucher-types', superAdminVoucherTypesRoutes);
router.use('/platform', aiToolCatalogRoutes);
router.use('/platform', aiProposalPolicyRoutes);
// Each system sub-router does `router.use(assertSuperAdmin)` internally,
// which runs for ANY request entering the sub-router. Mounting them with
// the correct path prefix means the assertSuperAdmin only fires for
// requests targeting /system/*, instead of every unmatched tenant URL
// that fell through to this router. Internal route paths now drop the
// shared prefix and use just the suffix.
router.use('/system/permissions', systemPermissionsRoutes);
router.use('/system/roles', systemRolesRoutes);
router.use('/system/module-settings', systemModuleSettingsRoutes);
router.use('/system', systemRoutes);

export default router;
