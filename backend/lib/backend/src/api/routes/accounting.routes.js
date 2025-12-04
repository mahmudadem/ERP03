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
const permissionsMiddleware_1 = require("../middlewares/permissionsMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
// Accounts
router.get('/accounts', AccountController_1.AccountController.list);
router.get('/accounts/:id', AccountController_1.AccountController.getById);
router.post('/accounts', AccountController_1.AccountController.create);
router.put('/accounts/:id', AccountController_1.AccountController.update);
router.delete('/accounts/:id', AccountController_1.AccountController.deactivate);
// Vouchers
router.get('/vouchers', VoucherController_1.VoucherController.list);
router.get('/vouchers/:id', VoucherController_1.VoucherController.get);
router.post('/vouchers', VoucherController_1.VoucherController.create);
router.put('/vouchers/:id', VoucherController_1.VoucherController.update);
router.post('/vouchers/:id/approve', VoucherController_1.VoucherController.approve);
router.post('/vouchers/:id/lock', VoucherController_1.VoucherController.lock);
router.post('/vouchers/:id/cancel', VoucherController_1.VoucherController.cancel);
// Reports
router.get('/reports/trial-balance', ReportingController_1.ReportingController.trialBalance);
router.get('/reports/general-ledger', ReportingController_1.ReportingController.generalLedger);
router.get('/reports/journal', ReportingController_1.ReportingController.journal);
// Designer (Module-specific)
router.get('/designer/voucher-types', (0, permissionsMiddleware_1.permissionsMiddleware)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', (0, permissionsMiddleware_1.permissionsMiddleware)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypeByCode);
router.put('/designer/voucher-types/:code/layout', (0, permissionsMiddleware_1.permissionsMiddleware)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.saveVoucherTypeLayout);
exports.default = router;
//# sourceMappingURL=accounting.routes.js.map