import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';
import { SystemRoleController } from '../controllers/system/SystemRoleController';

const router = Router();
router.use(authMiddleware);
router.use(assertSuperAdmin);

// Routes are mounted under '/system/roles' by platform.router so the
// internal paths drop the prefix. External URL stays /system/roles/*.
router.get('/', SystemRoleController.list);
router.get('/:roleId', SystemRoleController.get);
router.post('/', SystemRoleController.create);
router.put('/:roleId', SystemRoleController.update);

export default router;
