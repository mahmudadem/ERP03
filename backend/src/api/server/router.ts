import { Router } from 'express';
import platformRouter from './platform.router';
import tenantRouter from './tenant.router';
import publicRouter from './public.router';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public/User Context Routes
// Note: Individual routes inside publicRouter must handle their own Auth if needed (e.g. coreRoutes does)
router.use(publicRouter);

// Tenant Routes (Company Context)
// These REQUIRE Auth AND Company Context
router.use('/tenant', tenantRouter);

// Platform Routes (Super Admin)
// Keep this after tenant routes because some platform sub-routers mount
// root-level guards internally. Tenant routes must not pass through them.
router.use(platformRouter);

export default router;
