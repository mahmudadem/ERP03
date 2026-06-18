import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { UserPreferencesController } from '../controllers/core/UserPreferencesController';
import { ignoreCompanyHeaderMiddleware } from '../middlewares/ignoreCompanyHeaderMiddleware';

const router = Router();

router.use(ignoreCompanyHeaderMiddleware);
router.use(authMiddleware);

router.get('/user/preferences', UserPreferencesController.getMyPreferences);
router.post('/user/preferences', UserPreferencesController.upsertMyPreferences);

export default router;

