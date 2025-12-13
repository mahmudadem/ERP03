import { Router } from 'express';
import authRoutes from '../routes/auth.routes';
import companyWizardRoutes from '../routes/company-wizard.routes';
import impersonationRoutes from '../routes/impersonation.routes';
import userCompaniesRoutes from '../routes/user.companies.routes';
import coreRoutes from '../routes/core.routes';
import onboardingRoutes from '../routes/onboarding.routes';
import companyModulesRoutes from '../routes/company-modules.routes';
import systemMetadataRoutes from '../routes/system.metadata.routes';

const router = Router();

router.use(authRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/company-wizard', companyWizardRoutes);
router.use('/impersonate', impersonationRoutes);
router.use(userCompaniesRoutes);
router.use('/core', coreRoutes);
router.use('/company-modules', companyModulesRoutes);
router.use('/system/metadata', systemMetadataRoutes);

export default router;


