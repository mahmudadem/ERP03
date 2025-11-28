
/**
 * core.routes.ts
 * Purpose: Defines API endpoints for Core module.
 */
import { Router } from 'express';
import { CompanyController } from '../controllers/core/CompanyController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Public routes (if any)
// ...

// Protected routes
router.use(authMiddleware);

router.post('/companies/create', CompanyController.createCompany);
router.get('/companies/my', CompanyController.getUserCompanies);

export default router;
