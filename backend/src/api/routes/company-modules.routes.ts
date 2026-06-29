import { Router } from 'express';
import { CompanyModulesController } from '../controllers/company/CompanyModulesController';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { requireCompanyParamMatchesContext } from '../middlewares/guards/companyContextGuard';

const router = Router();
// Use the DI-bound repository so this honors DB_TYPE (Prisma in SQL mode,
// Firestore in Firestore mode). Previously hardwired to Firestore, which made
// the module list/initialize read/write the wrong database in SQL mode — the
// frontend then never saw SQL-initialized modules and looped on setup wizards.
const companyModuleRepo = diContainer.companyModuleRepository;
const controller = new CompanyModulesController(companyModuleRepo as any);

/**
 * All routes require authentication and company access
 */

// List all modules for a company
router.get(
  '/:companyId',
  authMiddleware,
  companyContextMiddleware,
  requireCompanyParamMatchesContext(),
  (req, res) => controller.listModules(req, res)
);

// Get specific module details
router.get(
  '/:companyId/:moduleCode',
  authMiddleware,
  companyContextMiddleware,
  requireCompanyParamMatchesContext(),
  (req, res) => controller.getModule(req, res)
);

// Initialize a module (mark as complete)
router.patch(
  '/:companyId/:moduleCode/initialize',
  authMiddleware,
  companyContextMiddleware,
  requireCompanyParamMatchesContext(),
  (req, res) => controller.initializeModule(req, res)
);

// Start initialization (mark as in-progress)
router.post(
  '/:companyId/:moduleCode/start-initialization',
  authMiddleware,
  companyContextMiddleware,
  requireCompanyParamMatchesContext(),
  (req, res) => controller.startInitialization(req, res)
);

export default router;
