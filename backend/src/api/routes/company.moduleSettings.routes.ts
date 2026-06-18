import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';
import { CompanyModuleSettingsController } from '../controllers/company/CompanyModuleSettingsController';
import { requireCompanyParamMatchesContext } from '../middlewares/guards/companyContextGuard';

const router = Router();
router.use(authMiddleware);

router.get(
  '/companies/:companyId/module-settings/:moduleId',
  requireCompanyParamMatchesContext(),
  permissionsMiddleware('module.settings.edit'),
  CompanyModuleSettingsController.getSettings
);
router.post(
  '/companies/:companyId/module-settings/:moduleId',
  requireCompanyParamMatchesContext(),
  permissionsMiddleware('module.settings.edit'),
  CompanyModuleSettingsController.saveSettings
);

export default router;
