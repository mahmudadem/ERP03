"use strict";
/**
 * accounting.routes.ts (Updated with designer routes)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AccountController_1 = require("../controllers/accounting/AccountController");
const VoucherController_1 = require("../controllers/accounting/VoucherController");
const ReportingController_1 = require("../controllers/accounting/ReportingController");
const AccountingDesignerController_1 = require("../controllers/accounting/AccountingDesignerController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionGuard_1 = require("../middlewares/guards/permissionGuard");
const featureFlagGuard_1 = require("../middlewares/guards/featureFlagGuard");
const router = (0, express_1.Router)();
// authMiddleware should be applied at tenant router level, but keeping here for safety if mounted elsewhere
router.use(authMiddleware_1.authMiddleware);
// Accounts
router.get('/accounts', (0, permissionGuard_1.permissionGuard)('accounting.account.view'), AccountController_1.AccountController.list);
router.get('/accounts/:id', (0, permissionGuard_1.permissionGuard)('accounting.account.view'), AccountController_1.AccountController.getById);
router.post('/accounts', (0, permissionGuard_1.permissionGuard)('accounting.account.create'), AccountController_1.AccountController.create);
router.put('/accounts/:id', (0, permissionGuard_1.permissionGuard)('accounting.account.edit'), AccountController_1.AccountController.update);
router.delete('/accounts/:id', (0, permissionGuard_1.permissionGuard)('accounting.account.delete'), AccountController_1.AccountController.deactivate);
// Vouchers
router.get('/vouchers', (0, permissionGuard_1.permissionGuard)('accounting.voucher.view'), VoucherController_1.VoucherController.list);
router.get('/vouchers/:id', (0, permissionGuard_1.permissionGuard)('accounting.voucher.view'), VoucherController_1.VoucherController.get);
router.post('/vouchers', (0, permissionGuard_1.permissionGuard)('accounting.voucher.create'), (0, featureFlagGuard_1.featureFlagGuard)('feature.multiCurrency'), VoucherController_1.VoucherController.create);
router.put('/vouchers/:id', (0, permissionGuard_1.permissionGuard)('accounting.voucher.edit'), VoucherController_1.VoucherController.update);
router.post('/vouchers/:id/approve', (0, permissionGuard_1.permissionGuard)('accounting.voucher.approve'), VoucherController_1.VoucherController.approve);
router.post('/vouchers/:id/lock', (0, permissionGuard_1.permissionGuard)('accounting.voucher.lock'), VoucherController_1.VoucherController.lock);
router.post('/vouchers/:id/cancel', (0, permissionGuard_1.permissionGuard)('accounting.voucher.cancel'), VoucherController_1.VoucherController.cancel);
// Reports
router.get('/reports/profit-loss', (0, permissionGuard_1.permissionGuard)('accounting.reports.profitAndLoss.view'), ReportingController_1.ReportingController.profitAndLoss);
router.get('/reports/trial-balance', (0, permissionGuard_1.permissionGuard)('accounting.report.view'), ReportingController_1.ReportingController.trialBalance);
router.get('/reports/general-ledger', (0, permissionGuard_1.permissionGuard)('accounting.report.view'), ReportingController_1.ReportingController.generalLedger);
router.get('/reports/journal', (0, permissionGuard_1.permissionGuard)('accounting.report.view'), ReportingController_1.ReportingController.journal);
// Designer (Module-specific)
router.get('/designer/voucher-types', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypeByCode);
router.post('/designer/voucher-types', (0, permissionGuard_1.permissionGuard)('accounting.designer.create'), AccountingDesignerController_1.AccountingDesignerController.create);
router.put('/designer/voucher-types/:code', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.update);
router.put('/designer/voucher-types/:code/layout', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.saveVoucherTypeLayout);
exports.default = router;
//# sourceMappingURL=accounting.routes.js.map