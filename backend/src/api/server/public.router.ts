import { Router } from 'express';
import authRoutes from '../routes/auth.routes';
import companyWizardRoutes from '../routes/company-wizard.routes';
import impersonationRoutes from '../routes/impersonation.routes';
import userCompaniesRoutes from '../routes/user.companies.routes';
import coreRoutes from '../routes/core.routes';

const router = Router();

router.use(authRoutes);
router.use('/company-wizard', companyWizardRoutes);
router.use('/impersonate', impersonationRoutes);
router.use(userCompaniesRoutes);
router.use('/core', coreRoutes);

export default router;
