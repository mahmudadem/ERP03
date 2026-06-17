import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { UserCompaniesController } from '../controllers/user/UserCompaniesController';
import { ignoreCompanyHeaderMiddleware } from '../middlewares/ignoreCompanyHeaderMiddleware';

const router = Router();

router.get('/users/me/companies', ignoreCompanyHeaderMiddleware, authMiddleware, UserCompaniesController.listUserCompanies);
router.post('/users/me/switch-company', ignoreCompanyHeaderMiddleware, authMiddleware, UserCompaniesController.switchCompany);
router.get('/users/me/active-company', ignoreCompanyHeaderMiddleware, authMiddleware, UserCompaniesController.getActiveCompany);

export default router;
