import { Router } from 'express';
import { SuperAdminVoucherTypeController } from '../controllers/super-admin/SuperAdminVoucherTypeController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/', SuperAdminVoucherTypeController.listSystemTemplates);
router.post('/', SuperAdminVoucherTypeController.createSystemTemplate);
router.put('/:id', SuperAdminVoucherTypeController.updateSystemTemplate);
router.delete('/:id', SuperAdminVoucherTypeController.deleteSystemTemplate);

export default router;
