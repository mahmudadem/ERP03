
/**
 * router.ts
 * Purpose: Aggregates all module routers into a single main router.
 */
import { Router } from 'express';
import coreRoutes from '../routes/core.routes';
// import accountingRoutes from '../routes/accounting.routes';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Module Routes
router.use('/', coreRoutes); // Mounts /companies/create, etc.
// router.use('/', accountingRoutes);

export default router;
