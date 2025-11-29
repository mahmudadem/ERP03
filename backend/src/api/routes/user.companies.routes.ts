import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { UserCompaniesController } from '../controllers/user/UserCompaniesController';

const router = Router();

router.use(authMiddleware);

router.get('/users/me/companies', UserCompaniesController.listUserCompanies);
router.post('/users/me/switch-company', UserCompaniesController.switchCompany);
router.get('/users/me/active-company', UserCompaniesController.getActiveCompany);

export default router;
