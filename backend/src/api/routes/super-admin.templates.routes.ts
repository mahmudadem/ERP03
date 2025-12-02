import { Router } from 'express';
import { TemplatesController } from '../controllers/super-admin/TemplatesController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/wizard-templates', TemplatesController.listWizardTemplates);
router.get('/coa-templates', TemplatesController.listCoaTemplates);
router.get('/currencies', TemplatesController.listCurrencies);

export default router;
