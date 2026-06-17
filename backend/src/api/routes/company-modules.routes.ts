import { Router } from 'express';
import * as admin from 'firebase-admin';
import { CompanyModulesController } from '../controllers/company/CompanyModulesController';
import { FirestoreCompanyModuleRepository } from '../../infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { requireCompanyParamMatchesContext } from '../middlewares/guards/companyContextGuard';

const router = Router();
const companyModuleRepo = new FirestoreCompanyModuleRepository(admin.firestore());
const controller = new CompanyModulesController(companyModuleRepo);

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
