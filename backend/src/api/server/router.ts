
/**
 * router.ts
 * Purpose: Aggregates all module routers into a single main router.
 */
import { Router } from 'express';
import coreRoutes from '../routes/core.routes';
import systemRoutes from '../routes/system.routes';
import accountingRoutes from '../routes/accounting.routes';
import inventoryRoutes from '../routes/inventory.routes';
import hrRoutes from '../routes/hr.routes';
import posRoutes from '../routes/pos.routes';
import designerRoutes from '../routes/designer.routes';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Module Routes
router.use('/core', coreRoutes);
router.use('/system', systemRoutes);
router.use('/accounting', accountingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/hr', hrRoutes);
router.use('/pos', posRoutes);
router.use('/designer', designerRoutes);

export default router;
