import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { UserCompaniesController } from '../controllers/user/UserCompaniesController';

const router = Router();

router.get('/users/me/companies', authMiddleware, UserCompaniesController.listUserCompanies);
router.post('/users/me/switch-company', authMiddleware, UserCompaniesController.switchCompany);
router.get('/users/me/active-company', authMiddleware, UserCompaniesController.getActiveCompany);

export default router;
