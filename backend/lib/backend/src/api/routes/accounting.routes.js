"use strict";
/**
 * accounting.routes.ts (Updated with designer routes)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AccountController_1 = require("../controllers/accounting/AccountController");
const VoucherController_1 = require("../controllers/accounting/VoucherController");
const VoucherFormController_1 = require("../controllers/accounting/VoucherFormController");
const ReportingController_1 = require("../controllers/accounting/ReportingController");
const AccountingReportsController_1 = require("../controllers/accounting/AccountingReportsController");
const AccountingDesignerController_1 = require("../controllers/accounting/AccountingDesignerController");
const SettingsController_1 = require("../controllers/accounting/SettingsController");
const CurrencyController_1 = require("../controllers/accounting/CurrencyController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const companyContextMiddleware_1 = require("../middlewares/companyContextMiddleware");
const permissionGuard_1 = require("../middlewares/guards/permissionGuard");
const router = (0, express_1.Router)();
// Apply auth and company context middlewares
router.use(authMiddleware_1.authMiddleware);
router.use(companyContextMiddleware_1.companyContextMiddleware);
// Accounts
router.get('/accounts', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), AccountController_1.AccountController.list);
router.get('/accounts/valid', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), AccountController_1.AccountController.getValid);
router.get('/accounts/resolve/:code', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), AccountController_1.AccountController.resolveCode);
router.get('/accounts/:id', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), AccountController_1.AccountController.getById);
router.post('/accounts', (0, permissionGuard_1.permissionGuard)('accounting.accounts.create'), AccountController_1.AccountController.create);
router.put('/accounts/:id', (0, permissionGuard_1.permissionGuard)('accounting.accounts.edit'), AccountController_1.AccountController.update);
router.delete('/accounts/:id', (0, permissionGuard_1.permissionGuard)('accounting.accounts.delete'), AccountController_1.AccountController.deactivate);
// Vouchers
router.get('/vouchers', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), VoucherController_1.VoucherController.list);
router.get('/vouchers/pending/approvals', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.approve'), VoucherController_1.VoucherController.getPendingApprovals);
router.get('/vouchers/pending/custody', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), VoucherController_1.VoucherController.getPendingCustody);
router.get('/vouchers/:id', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), VoucherController_1.VoucherController.get);
router.post('/vouchers', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), VoucherController_1.VoucherController.create);
router.put('/vouchers/:id', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.edit'), VoucherController_1.VoucherController.update);
router.post('/vouchers/:id/approve', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.edit'), VoucherController_1.VoucherController.approve);
router.post('/vouchers/:id/verify', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.approve'), VoucherController_1.VoucherController.verify);
router.post('/vouchers/:id/confirm', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), VoucherController_1.VoucherController.confirm); // V1: View perm + user check in controller
router.post('/vouchers/:id/post', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.post'), VoucherController_1.VoucherController.post);
router.post('/vouchers/:id/correct', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.correct'), VoucherController_1.VoucherController.correct);
router.delete('/vouchers/:id', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.delete'), VoucherController_1.VoucherController.delete);
// router.post('/vouchers/:id/lock', permissionGuard('accounting.vouchers.lock'), VoucherController.lock); // Disabled - not implemented
router.post('/vouchers/:id/reject', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.approve'), VoucherController_1.VoucherController.reject);
router.post('/vouchers/:id/cancel', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.cancel'), VoucherController_1.VoucherController.cancel);
// Reports
router.get('/reports/profit-loss', (0, permissionGuard_1.permissionGuard)('accounting.reports.profitAndLoss.view'), ReportingController_1.ReportingController.profitAndLoss);
router.get('/reports/trial-balance', (0, permissionGuard_1.permissionGuard)('accounting.reports.trialBalance.view'), AccountingReportsController_1.AccountingReportsController.getTrialBalance);
router.get('/reports/general-ledger', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), AccountingReportsController_1.AccountingReportsController.getGeneralLedger);
router.get('/reports/journal', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), ReportingController_1.ReportingController.journal);
// Designer (Module-specific)
router.get('/designer/voucher-types', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypeByCode);
router.post('/designer/voucher-types', (0, permissionGuard_1.permissionGuard)('accounting.designer.create'), AccountingDesignerController_1.AccountingDesignerController.create);
router.put('/designer/voucher-types/:code', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.update);
router.put('/designer/voucher-types/:code/layout', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.saveVoucherTypeLayout);
// Policy Configuration
router.get('/policy-config', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), SettingsController_1.SettingsController.getSettings);
router.put('/policy-config', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), SettingsController_1.SettingsController.updateSettings);
// VoucherForms (UI layouts)
router.get('/voucher-forms', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), VoucherFormController_1.VoucherFormController.list);
router.get('/voucher-forms/by-type/:typeId', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), VoucherFormController_1.VoucherFormController.getByType);
router.get('/voucher-forms/:id', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), VoucherFormController_1.VoucherFormController.getById);
router.post('/voucher-forms', (0, permissionGuard_1.permissionGuard)('accounting.designer.create'), VoucherFormController_1.VoucherFormController.create);
router.put('/voucher-forms/:id', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), VoucherFormController_1.VoucherFormController.update);
router.delete('/voucher-forms/:id', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), VoucherFormController_1.VoucherFormController.delete);
router.post('/voucher-forms/:id/clone', (0, permissionGuard_1.permissionGuard)('accounting.designer.create'), VoucherFormController_1.VoucherFormController.clone);
// Currencies
router.get('/currencies', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyController_1.CurrencyController.listCurrencies);
router.get('/currencies/:code', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyController_1.CurrencyController.getCurrency);
router.get('/company/currencies', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyController_1.CurrencyController.listCompanyCurrencies);
router.post('/company/currencies', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CurrencyController_1.CurrencyController.enableCurrency);
router.delete('/company/currencies/:code', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CurrencyController_1.CurrencyController.disableCurrency);
// Exchange Rates
router.get('/exchange-rates/history', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), CurrencyController_1.CurrencyController.listRateHistory);
router.get('/exchange-rates/matrix', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyController_1.CurrencyController.getLatestRatesMatrix);
router.get('/exchange-rates/suggested', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), CurrencyController_1.CurrencyController.getSuggestedRate);
router.post('/exchange-rates', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), CurrencyController_1.CurrencyController.saveRate);
router.post('/exchange-rates/check-deviation', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), CurrencyController_1.CurrencyController.checkRateDeviation);
exports.default = router;
//# sourceMappingURL=accounting.routes.js.map