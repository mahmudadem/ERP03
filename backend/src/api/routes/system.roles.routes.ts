import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';
import { SystemRoleController } from '../controllers/system/SystemRoleController';

const router = Router();
router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/system/roles', SystemRoleController.list);
router.get('/system/roles/:roleId', SystemRoleController.get);
router.post('/system/roles', SystemRoleController.create);
router.put('/system/roles/:roleId', SystemRoleController.update);

export default router;
