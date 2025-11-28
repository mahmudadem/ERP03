import { Router } from 'express';
import { InventoryController } from '../controllers/inventory/InventoryController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

router.post('/items', permissionsMiddleware('inventory.items.create'), InventoryController.createItem);
router.post('/warehouses', permissionsMiddleware('inventory.warehouses.create'), InventoryController.createWarehouse);

export default router;