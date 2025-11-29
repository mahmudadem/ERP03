import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';
import { ModulePermissionsController } from '../controllers/system/ModulePermissionsController';

const router = Router();
router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/system/permissions/modules', ModulePermissionsController.listModules);
router.get('/system/permissions/:moduleId', ModulePermissionsController.getByModule);
router.post('/system/permissions/:moduleId', ModulePermissionsController.create);
router.put('/system/permissions/:moduleId', ModulePermissionsController.upsert);
router.delete('/system/permissions/:moduleId', ModulePermissionsController.remove);

export default router;
