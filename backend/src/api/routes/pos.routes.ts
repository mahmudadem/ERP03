import { Router } from 'express';
import { PosController } from '../controllers/pos/PosController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware';

const router = Router();
router.use(authMiddleware);

// Initialize is open to any authenticated user with module access (the entitlement
// gate `companyModuleGuard('pos')` already runs at the tenant router mount).
router.post('/initialize', PosController.initializePos);

// Settings
router.get('/settings', permissionGuard('pos.settings.manage'), PosController.getSettings);
router.put('/settings', permissionGuard('pos.settings.manage'), PosController.updateSettings);
router.get('/policy', permissionGuard('pos.settings.manage'), PosController.getPolicy);
router.put('/policy', permissionGuard('pos.settings.manage'), PosController.updatePolicy);
// Shared company-wide selling policy (below-cost / margin). POS-independent doorway
// to the same store Sales edits, so a POS-only tenant can configure it.
router.get('/selling-policy', permissionGuard('pos.settings.manage'), PosController.getSellingPolicy);
router.put('/selling-policy', permissionGuard('pos.settings.manage'), PosController.updateSellingPolicy);

// Registers
router.get('/registers', permissionGuard('pos.registers.manage'), PosController.listRegisters);
router.post('/registers', permissionGuard('pos.registers.manage'), PosController.createRegister);
router.get('/registers/:id', permissionGuard('pos.registers.manage'), PosController.getRegister);
router.put('/registers/:id', permissionGuard('pos.registers.manage'), PosController.updateRegister);

// Shifts
router.post('/shifts/open', permissionGuard('pos.shift.open'), PosController.openShift);
router.post('/shifts/:id/close', permissionGuard('pos.shift.close'), PosController.closeShift);
router.post('/shifts/:id/force-close', permissionGuard('pos.shift.forceClose'), PosController.forceCloseShift);
router.post('/shifts/:id/cash-movements', permissionGuard('pos.cash.movement'), PosController.createCashMovement);
router.get('/shifts', permissionGuard('pos.terminal.access'), PosController.listShifts);
router.get('/shifts/:id', permissionGuard('pos.terminal.access'), PosController.getShift);
router.get('/shifts/:id/x-report', permissionGuard('pos.terminal.access'), PosController.getXReport);

// Sale / Receipts
router.get('/bootstrap', permissionGuard('pos.terminal.access'), PosController.getBootstrap);
router.get('/layout/runtime', permissionGuard('pos.terminal.access'), PosController.getRuntimeLayout);
router.get('/products/search', permissionGuard('pos.terminal.access'), PosController.searchProducts);
router.post('/sales/preview', permissionGuard('pos.terminal.access'), PosController.previewSale);
router.post('/sales', idempotencyMiddleware, permissionGuard('pos.terminal.access'), PosController.completeSale);

// Layout/admin configuration
router.get('/commands', permissionGuard('pos.settings.manage'), PosController.listCommandCodes);
router.post('/commands/execute', permissionGuard('pos.terminal.access'), PosController.executeCommand);
router.get('/product-shortcut-layouts', permissionGuard('pos.settings.manage'), PosController.listProductShortcutLayouts);
router.post('/product-shortcut-layouts', permissionGuard('pos.settings.manage'), PosController.createProductShortcutLayout);
router.put('/product-shortcut-layouts/:id', permissionGuard('pos.settings.manage'), PosController.updateProductShortcutLayout);
router.patch('/product-shortcut-layouts/:id', permissionGuard('pos.settings.manage'), PosController.updateProductShortcutLayout);
router.delete('/product-shortcut-layouts/:id', permissionGuard('pos.settings.manage'), PosController.deleteProductShortcutLayout);
router.get('/product-shortcut-layouts/:layoutId/nodes', permissionGuard('pos.settings.manage'), PosController.listProductShortcutNodes);
router.post('/product-shortcut-layouts/:layoutId/nodes', permissionGuard('pos.settings.manage'), PosController.createProductShortcutNode);
router.put('/product-shortcut-nodes/:id', permissionGuard('pos.settings.manage'), PosController.updateProductShortcutNode);
router.patch('/product-shortcut-nodes/:id', permissionGuard('pos.settings.manage'), PosController.updateProductShortcutNode);
router.delete('/product-shortcut-nodes/:id', permissionGuard('pos.settings.manage'), PosController.deleteProductShortcutNode);
router.get('/control-button-layouts', permissionGuard('pos.settings.manage'), PosController.listControlButtonLayouts);
router.post('/control-button-layouts', permissionGuard('pos.settings.manage'), PosController.createControlButtonLayout);
router.put('/control-button-layouts/:id', permissionGuard('pos.settings.manage'), PosController.updateControlButtonLayout);
router.patch('/control-button-layouts/:id', permissionGuard('pos.settings.manage'), PosController.updateControlButtonLayout);
router.delete('/control-button-layouts/:id', permissionGuard('pos.settings.manage'), PosController.deleteControlButtonLayout);
router.get('/control-button-layouts/:layoutId/buttons', permissionGuard('pos.settings.manage'), PosController.listControlButtons);
router.post('/control-button-layouts/:layoutId/buttons', permissionGuard('pos.settings.manage'), PosController.createControlButton);
router.put('/control-buttons/:id', permissionGuard('pos.settings.manage'), PosController.updateControlButton);
router.patch('/control-buttons/:id', permissionGuard('pos.settings.manage'), PosController.updateControlButton);
router.delete('/control-buttons/:id', permissionGuard('pos.settings.manage'), PosController.deleteControlButton);

router.get('/held-carts', permissionGuard('pos.terminal.access'), PosController.listHeldCarts);
router.post('/held-carts', idempotencyMiddleware, permissionGuard('pos.terminal.access'), PosController.holdCart);
router.get('/held-carts/:id', permissionGuard('pos.terminal.access'), PosController.getHeldCart);
router.post('/held-carts/:id/recall', permissionGuard('pos.terminal.access'), PosController.recallHeldCart);
router.post('/held-carts/:id/cancel', permissionGuard('pos.terminal.access'), PosController.cancelHeldCart);
router.get('/receipts', permissionGuard('pos.terminal.access'), PosController.listReceipts);
router.get('/receipts/:id', permissionGuard('pos.terminal.access'), PosController.getReceipt);
router.get('/receipts/:id/print', permissionGuard('pos.terminal.access'), PosController.printReceipt);
router.get('/receipts/:id/reprint', permissionGuard('pos.receipt.reprint'), PosController.reprintReceipt);
router.post('/receipts/:id/void', idempotencyMiddleware, permissionGuard('pos.return.create'), PosController.voidReceipt);
router.post('/manager-overrides', permissionGuard('pos.terminal.access'), PosController.createManagerOverride);

// Returns
router.post('/exchanges', idempotencyMiddleware, permissionGuard('pos.return.create'), permissionGuard('pos.terminal.access'), PosController.completeExchange);
router.post('/returns', idempotencyMiddleware, permissionGuard('pos.return.create'), PosController.completeReturn);
router.get('/returns', permissionGuard('pos.terminal.access'), PosController.listReturns);
router.get('/returns/:id', permissionGuard('pos.terminal.access'), PosController.getReturn);

// Reports
router.get('/shifts/:id/z-report', permissionGuard('pos.reports.view'), PosController.getZReport);
router.get('/reports/daily-summary', permissionGuard('pos.reports.view'), PosController.getDailySummary);
router.get('/reports/payment-methods', permissionGuard('pos.reports.view'), PosController.getPaymentMethodSummary);
router.get('/reports/cashier-sales', permissionGuard('pos.reports.view'), PosController.getCashierSales);
router.get('/reports/cash-over-short', permissionGuard('pos.reports.view'), PosController.getCashOverShort);
router.get('/reports/receipt-history', permissionGuard('pos.reports.view'), PosController.getReceiptHistory);
router.get('/reports/cancelled-receipts', permissionGuard('pos.reports.view'), PosController.getCancelledReceipts);
router.get('/reports/top-selling-items', permissionGuard('pos.reports.view'), PosController.getTopSellingItems);
router.get('/reports/override-audit', permissionGuard('pos.reports.view'), PosController.getOverrideAuditReport);
router.get('/reports/reprint-audit', permissionGuard('pos.reports.view'), PosController.getReprintAuditReport);

export default router;
