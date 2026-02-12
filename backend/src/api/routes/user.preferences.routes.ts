import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { UserPreferencesController } from '../controllers/core/UserPreferencesController';

const router = Router();

router.use(authMiddleware);

router.get('/user/preferences', UserPreferencesController.getMyPreferences);
router.post('/user/preferences', UserPreferencesController.upsertMyPreferences);

export default router;

