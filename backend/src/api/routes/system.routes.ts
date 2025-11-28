
import { Router } from 'express';
import { SystemController } from '../controllers/system/SystemController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
router.use(authMiddleware);

router.post('/roles', SystemController.createRole);

export default router;
