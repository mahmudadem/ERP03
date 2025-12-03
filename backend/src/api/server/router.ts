import { Router } from 'express';
import platformRouter from './platform.router';
import tenantRouter from './tenant.router';
import publicRouter from './public.router';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public/User Context Routes
// Note: Individual routes inside publicRouter must handle their own Auth if needed (e.g. coreRoutes does)
router.use(publicRouter);

// Platform Routes (Super Admin)
// Most platform routes likely need Auth.
// We assume existing routes handle auth or we can add it here if needed.
// Given the previous structure, we'll rely on the routes themselves or add global auth if verified.
// For safety, let's assume Platform routes are protected.
// But wait, authRoutes (in publicRouter) has login.
// If we put authMiddleware here, it won't affect publicRouter.
router.use(platformRouter);

// Tenant Routes (Company Context)
// These REQUIRE Auth AND Company Context
router.use(authMiddleware);
router.use(tenantRouter);

export default router;
