import { Router } from 'express';
import { InventoryController } from '../controllers/inventory/InventoryController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';
import { moduleInitializedGuard } from '../middlewares/guards/moduleInitializedGuard';

const router = Router();
router.use(authMiddleware);

router.post('/initialize', permissionGuard('inventory.settings.manage'), InventoryController.initialize);
router.get('/settings', permissionGuard('inventory.view'), InventoryController.getSettings);

router.use(moduleInitializedGuard('inventory'));

router.put('/settings', permissionGuard('inventory.settings.manage'), InventoryController.updateSettings);

router.get('/items/search', permissionGuard('inventory.items.view'), InventoryController.searchItems);
router.post('/items', permissionGuard('inventory.items.manage'), InventoryController.createItem);
router.get('/items', permissionGuard('inventory.items.view'), InventoryController.listItems);
router.get('/items/:id', permissionGuard('inventory.items.view'), InventoryController.getItem);
router.put('/items/:id', permissionGuard('inventory.items.manage'), InventoryController.updateItem);
router.delete('/items/:id', permissionGuard('inventory.items.manage'), InventoryController.deleteItem);

router.post('/categories', permissionGuard('inventory.categories.manage'), InventoryController.createCategory);
router.get('/categories', permissionGuard('inventory.categories.view'), InventoryController.listCategories);
router.put('/categories/:id', permissionGuard('inventory.categories.manage'), InventoryController.updateCategory);
router.delete('/categories/:id', permissionGuard('inventory.categories.manage'), InventoryController.deleteCategory);

router.post('/warehouses', permissionGuard('inventory.warehouses.manage'), InventoryController.createWarehouse);
router.get('/warehouses', permissionGuard('inventory.warehouses.view'), InventoryController.listWarehouses);
router.get('/warehouses/:id', permissionGuard('inventory.warehouses.view'), InventoryController.getWarehouse);
router.put('/warehouses/:id', permissionGuard('inventory.warehouses.manage'), InventoryController.updateWarehouse);

router.post('/uoms', permissionGuard('inventory.uom.manage'), InventoryController.createUom);
router.get('/uoms', permissionGuard('inventory.uom.view'), InventoryController.listUoms);
router.get('/uoms/:id', permissionGuard('inventory.uom.view'), InventoryController.getUom);
router.put('/uoms/:id', permissionGuard('inventory.uom.manage'), InventoryController.updateUom);
router.post('/uom-conversions', permissionGuard('inventory.uom.manage'), InventoryController.createUomConversion);
router.get('/uom-conversions/:itemId', permissionGuard('inventory.uom.view'), InventoryController.listUomConversions);
router.get('/uom-conversions/:id/impact', permissionGuard('inventory.uom.view'), InventoryController.getUomConversionImpact);
router.post('/uom-conversions/:id/apply-correction', permissionGuard('inventory.uom.manage'), InventoryController.applyUomConversionCorrection);
router.put('/uom-conversions/:id', permissionGuard('inventory.uom.manage'), InventoryController.updateUomConversion);
router.delete('/uom-conversions/:id', permissionGuard('inventory.uom.manage'), InventoryController.deleteUomConversion);

router.get('/stock-levels', permissionGuard('inventory.stock.view'), InventoryController.getStockLevels);
router.post('/stock-levels/reserve', permissionGuard('inventory.stock.adjust'), InventoryController.reserveStock);
router.post('/stock-levels/release', permissionGuard('inventory.stock.adjust'), InventoryController.releaseStock);
router.get('/stock-levels/:itemId', permissionGuard('inventory.stock.view'), InventoryController.getStockLevelsByItem);

router.get('/movements', permissionGuard('inventory.movements.view'), InventoryController.getMovements);
router.get('/movements/by-reference', permissionGuard('inventory.movements.view'), InventoryController.getMovementByReference);
router.get('/movements/:itemId', permissionGuard('inventory.movements.view'), InventoryController.getMovementsByItem);
router.post('/movements/opening', permissionGuard('inventory.movements.record'), InventoryController.recordOpeningStock);
router.post('/movements/return', permissionGuard('inventory.movements.record'), InventoryController.processReturn);
router.post('/opening-stock-documents', permissionGuard('inventory.movements.record'), InventoryController.createOpeningStockDocument);
router.get('/opening-stock-documents', permissionGuard('inventory.movements.record'), InventoryController.listOpeningStockDocuments);
router.put('/opening-stock-documents/:id', permissionGuard('inventory.movements.record'), InventoryController.updateOpeningStockDocument);
router.delete('/opening-stock-documents/:id', permissionGuard('inventory.movements.record'), InventoryController.deleteOpeningStockDocument);
router.post('/opening-stock-documents/:id/post', permissionGuard('inventory.movements.record'), InventoryController.postOpeningStockDocument);

router.post('/adjustments', permissionGuard('inventory.stock.adjust'), InventoryController.createAdjustment);
router.get('/adjustments', permissionGuard('inventory.stock.adjust'), InventoryController.listAdjustments);
router.post('/adjustments/:id/post', permissionGuard('inventory.stock.adjust'), InventoryController.postAdjustment);

router.post('/transfers', permissionGuard('inventory.stock.adjust'), InventoryController.createTransfer);
router.post('/transfers/:id/complete', permissionGuard('inventory.stock.adjust'), InventoryController.completeTransfer);
router.get('/transfers', permissionGuard('inventory.stock.view'), InventoryController.listTransfers);

router.post('/snapshots', permissionGuard('inventory.valuation.view'), InventoryController.createSnapshot);
router.get('/valuation/as-of', permissionGuard('inventory.valuation.view'), InventoryController.getAsOfValuation);
router.get('/valuation', permissionGuard('inventory.valuation.view'), InventoryController.getValuation);
router.get('/costs/current', permissionGuard('inventory.stock.view'), InventoryController.getCurrentCost);
router.get('/dashboard', permissionGuard('inventory.view'), InventoryController.getDashboard);
router.get('/alerts/low-stock', permissionGuard('inventory.stock.view'), InventoryController.getLowStockAlerts);
router.get('/reports/unsettled-costs', permissionGuard('inventory.movements.view'), InventoryController.getUnsettledCosts);
router.post('/reconcile', permissionGuard('inventory.reconcile.run'), InventoryController.reconcile);

export default router;
