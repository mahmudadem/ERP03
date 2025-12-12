import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { AuthPermissionsController } from '../controllers/auth/AuthPermissionsController';

const router = Router();

// Apply authMiddleware only to specific routes that need it
router.get('/auth/me/permissions', authMiddleware, AuthPermissionsController.getMyPermissions);

export default router;
