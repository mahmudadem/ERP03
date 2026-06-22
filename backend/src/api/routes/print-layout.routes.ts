import { Router } from 'express';
import { PrintLayoutController } from '../controllers/print-layout/PrintLayoutController';
import { permissionGuard } from '../middlewares/guards/permissionGuard';

const router = Router();

router.get('/schemas/:documentType', permissionGuard('system.company.settings.manage'), PrintLayoutController.schema);
router.get('/templates', permissionGuard('system.company.settings.manage'), PrintLayoutController.list);
router.get('/templates/:id', permissionGuard('system.company.settings.manage'), PrintLayoutController.get);
router.post('/templates/default', permissionGuard('system.company.settings.manage'), PrintLayoutController.createDefault);
router.post('/templates', permissionGuard('system.company.settings.manage'), PrintLayoutController.save);
router.put('/templates/:id', permissionGuard('system.company.settings.manage'), PrintLayoutController.save);
router.delete('/templates/:id', permissionGuard('system.company.settings.manage'), PrintLayoutController.remove);

export default router;
