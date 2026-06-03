import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { CommunicationsController } from '../controllers/CommunicationsController';

const router = Router();
router.use(authMiddleware);
router.use(companyContextMiddleware);

router.get('/settings', CommunicationsController.getSettings);
router.put('/settings', CommunicationsController.updateSettings);

export default router;
