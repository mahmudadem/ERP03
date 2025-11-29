import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';
import { CompanyModuleSettingsController } from '../controllers/company/CompanyModuleSettingsController';

const router = Router();
router.use(authMiddleware);

router.get('/companies/:companyId/module-settings/:moduleId', permissionsMiddleware('module.settings.edit'), CompanyModuleSettingsController.getSettings);
router.post('/companies/:companyId/module-settings/:moduleId', permissionsMiddleware('module.settings.edit'), CompanyModuleSettingsController.saveSettings);

export default router;
