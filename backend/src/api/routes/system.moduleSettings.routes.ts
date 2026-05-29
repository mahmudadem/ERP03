import { Router } from 'express';
import { ModuleSettingsDefinitionsController } from '../controllers/system/ModuleSettingsDefinitionsController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();
router.use(authMiddleware);
router.use(assertSuperAdmin);

// Routes are mounted under '/system/module-settings' by platform.router so
// the internal paths drop the prefix. External URL stays
// /system/module-settings/*.
router.get('/definitions', ModuleSettingsDefinitionsController.list);
router.get('/definitions/:moduleId', ModuleSettingsDefinitionsController.get);
router.post('/definitions', ModuleSettingsDefinitionsController.create);
router.put('/definitions/:moduleId', ModuleSettingsDefinitionsController.update);
router.delete('/definitions/:moduleId', ModuleSettingsDefinitionsController.remove);

export default router;
