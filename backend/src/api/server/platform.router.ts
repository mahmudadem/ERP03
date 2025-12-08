import { Router } from 'express';
import superAdminRoutes from '../routes/super-admin.routes';
import superAdminTemplatesRoutes from '../routes/super-admin.templates.routes';
import superAdminVoucherTypesRoutes from '../routes/super-admin.voucher-types.routes';
import systemPermissionsRoutes from '../routes/system.permissions.routes';
import systemRolesRoutes from '../routes/system.roles.routes';
import systemModuleSettingsRoutes from '../routes/system.moduleSettings.routes';
import systemRoutes from '../routes/system.routes';

const router = Router();

router.use('/super-admin', superAdminRoutes);
router.use('/super-admin/templates', superAdminTemplatesRoutes);
router.use('/super-admin/voucher-types', superAdminVoucherTypesRoutes);
router.use(systemPermissionsRoutes);
router.use(systemRolesRoutes);
router.use(systemModuleSettingsRoutes);
router.use('/system', systemRoutes);

export default router;
