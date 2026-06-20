import { Router } from 'express';
import { PosController } from '../controllers/pos/PosController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';

const router = Router();
router.use(authMiddleware);

// Initialize is open to any authenticated user with module access (the entitlement
// gate `companyModuleGuard('pos')` already runs at the tenant router mount).
router.post('/initialize', PosController.initializePos);

// Settings
router.get('/settings', permissionGuard('pos.settings.manage'), PosController.getSettings);
router.put('/settings', permissionGuard('pos.settings.manage'), PosController.updateSettings);

// Registers
router.get('/registers', permissionGuard('pos.registers.manage'), PosController.listRegisters);
router.post('/registers', permissionGuard('pos.registers.manage'), PosController.createRegister);
router.get('/registers/:id', permissionGuard('pos.registers.manage'), PosController.getRegister);
router.put('/registers/:id', permissionGuard('pos.registers.manage'), PosController.updateRegister);

export default router;
