import { Router } from 'express';
import { InventoryController } from '../controllers/inventory/InventoryController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';

const router = Router();
router.use(authMiddleware);

router.post('/items', permissionGuard('inventory.items.create'), InventoryController.createItem);
router.get('/items', permissionGuard('inventory.items.view'), InventoryController.listItems);
router.post('/warehouses', permissionGuard('inventory.warehouses.create'), InventoryController.createWarehouse);

export default router;