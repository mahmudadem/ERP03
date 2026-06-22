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
router.get('/products/search', permissionGuard('pos.terminal.access'), PosController.searchProducts);
router.post('/sales/preview', permissionGuard('pos.terminal.access'), PosController.previewSale);
router.post('/sales', idempotencyMiddleware, permissionGuard('pos.terminal.access'), PosController.completeSale);
router.get('/receipts', permissionGuard('pos.terminal.access'), PosController.listReceipts);
router.get('/receipts/:id', permissionGuard('pos.terminal.access'), PosController.getReceipt);
router.get('/receipts/:id/reprint', permissionGuard('pos.receipt.reprint'), PosController.reprintReceipt);
router.post('/receipts/:id/void', idempotencyMiddleware, permissionGuard('pos.return.create'), PosController.voidReceipt);

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
router.get('/reports/override-audit', permissionGuard('pos.reports.view'), PosController.getOverrideAuditReport);

export default router;
