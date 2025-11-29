import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { AuthPermissionsController } from '../controllers/auth/AuthPermissionsController';

const router = Router();
router.use(authMiddleware);

router.get('/auth/me/permissions', AuthPermissionsController.getMyPermissions);

export default router;
