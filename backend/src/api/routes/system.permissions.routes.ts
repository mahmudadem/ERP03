import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';
import { ModulePermissionsController } from '../controllers/system/ModulePermissionsController';

const router = Router();
router.use(authMiddleware);
router.use(assertSuperAdmin);

// Routes are mounted under '/system/permissions' by platform.router so the
// internal paths drop the prefix. External URL stays /system/permissions/*.
router.get('/modules', ModulePermissionsController.listModules);
router.get('/:moduleId', ModulePermissionsController.getByModule);
router.post('/:moduleId', ModulePermissionsController.create);
router.put('/:moduleId', ModulePermissionsController.upsert);
router.delete('/:moduleId', ModulePermissionsController.remove);

export default router;
