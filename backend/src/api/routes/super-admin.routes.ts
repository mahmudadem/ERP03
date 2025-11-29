
import { Router } from 'express';
import { SuperAdminController } from '../controllers/super-admin/SuperAdminController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/users', SuperAdminController.listAllUsers);
router.patch('/users/:userId/promote', SuperAdminController.promoteUser);
router.patch('/users/:userId/demote', SuperAdminController.demoteUser);
router.get('/companies', SuperAdminController.listAllCompanies);
router.get('/overview', SuperAdminController.getSystemOverview);

export default router;
