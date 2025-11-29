
import { Router } from 'express';
import { ImpersonationController } from '../controllers/impersonation/ImpersonationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

router.use(authMiddleware);
router.use(assertSuperAdmin);

router.post('/start', ImpersonationController.startImpersonation);
router.post('/stop', ImpersonationController.stopImpersonation);
router.get('/status', ImpersonationController.getImpersonationStatus);

export default router;
