import { Router } from 'express';
import { CompanyWizardController } from '../controllers/super-admin/CompanyWizardController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);
router.get('/models', CompanyWizardController.getModels);
router.get('/steps', CompanyWizardController.getSteps);
router.post('/start', CompanyWizardController.start);
router.get('/step', CompanyWizardController.getStep);
router.post('/step', CompanyWizardController.submitStep);
router.get('/options', CompanyWizardController.getOptions);
router.post('/complete', CompanyWizardController.complete);

export default router;
