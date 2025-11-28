
import { Router } from 'express';
import { CompanyController } from '../controllers/core/CompanyController';
import { CompanySettingsController } from '../controllers/core/CompanySettingsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Protected routes
router.use(authMiddleware);

router.post('/companies/create', CompanyController.createCompany);
router.get('/companies/my', CompanyController.getUserCompanies);

// Settings
router.get('/company/settings', CompanySettingsController.getSettings);
router.post('/company/settings', CompanySettingsController.updateSettings);

export default router;
