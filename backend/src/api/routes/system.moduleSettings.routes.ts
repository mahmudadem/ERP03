import { Router } from 'express';
import { ModuleSettingsDefinitionsController } from '../controllers/system/ModuleSettingsDefinitionsController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();
router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/system/module-settings/definitions', ModuleSettingsDefinitionsController.list);
router.get('/system/module-settings/definitions/:moduleId', ModuleSettingsDefinitionsController.get);
router.post('/system/module-settings/definitions', ModuleSettingsDefinitionsController.create);
router.put('/system/module-settings/definitions/:moduleId', ModuleSettingsDefinitionsController.update);
router.delete('/system/module-settings/definitions/:moduleId', ModuleSettingsDefinitionsController.remove);

export default router;
