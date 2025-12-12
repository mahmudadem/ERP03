import { Router } from 'express';
import * as admin from 'firebase-admin';
import { CompanyModulesController } from '../controllers/company/CompanyModulesController';
import { FirestoreCompanyModuleRepository } from '../../infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';

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
  (req, res) => controller.listModules(req, res)
);

// Get specific module details
router.get(
  '/:companyId/:moduleCode',
  authMiddleware,
  companyContextMiddleware,
  (req, res) => controller.getModule(req, res)
);

// Initialize a module (mark as complete)
router.patch(
  '/:companyId/:moduleCode/initialize',
  authMiddleware,
  companyContextMiddleware,
  (req, res) => controller.initializeModule(req, res)
);

// Start initialization (mark as in-progress)
router.post(
  '/:companyId/:moduleCode/start-initialization',
  authMiddleware,
  companyContextMiddleware,
  (req, res) => controller.startInitialization(req, res)
);

export default router;
