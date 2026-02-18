"use strict";
/**
 * accounting.routes.ts (Updated with designer routes)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
const FiscalYearController_1 = require("../controllers/accounting/FiscalYearController");
const CostCenterController_1 = require("../controllers/accounting/CostCenterController");
const VoucherSequenceController_1 = require("../controllers/accounting/VoucherSequenceController");
const BankReconciliationController_1 = require("../controllers/accounting/BankReconciliationController");
const BudgetController_1 = require("../controllers/accounting/BudgetController");
const ConsolidationController_1 = require("../controllers/accounting/ConsolidationController");
const RecurringVoucherController_1 = require("../controllers/accounting/RecurringVoucherController");
const AttachmentController_1 = require("../controllers/accounting/AttachmentController");
const multer_1 = __importDefault(require("multer"));
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
router.get('/reports/balance-sheet', (0, permissionGuard_1.permissionGuard)('accounting.reports.balanceSheet.view'), AccountingReportsController_1.AccountingReportsController.getBalanceSheet);
router.get('/reports/trial-balance', (0, permissionGuard_1.permissionGuard)('accounting.reports.trialBalance.view'), AccountingReportsController_1.AccountingReportsController.getTrialBalance);
router.get('/reports/general-ledger', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), AccountingReportsController_1.AccountingReportsController.getGeneralLedger);
router.get('/reports/account-statement', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), AccountingReportsController_1.AccountingReportsController.getAccountStatement);
router.get('/reports/journal', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), ReportingController_1.ReportingController.journal);
router.get('/reports/dashboard-summary', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), AccountingReportsController_1.AccountingReportsController.getDashboardSummary);
router.get('/reports/cash-flow', (0, permissionGuard_1.permissionGuard)('accounting.reports.cashFlow.view'), AccountingReportsController_1.AccountingReportsController.getCashFlow);
router.get('/reports/aging', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), AccountingReportsController_1.AccountingReportsController.getAgingReport);
router.get('/reports/budget-vs-actual', (0, permissionGuard_1.permissionGuard)('accounting.reports.trialBalance.view'), BudgetController_1.BudgetController.budgetVsActual);
// Bank Reconciliation
router.post('/bank-statements/import', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), BankReconciliationController_1.BankReconciliationController.import);
router.get('/bank-statements', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), BankReconciliationController_1.BankReconciliationController.listStatements);
router.get('/reconciliation/:accountId', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), BankReconciliationController_1.BankReconciliationController.getReconciliation);
router.post('/reconciliation/:accountId/complete', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), BankReconciliationController_1.BankReconciliationController.complete);
router.post('/reconciliation/match', (0, permissionGuard_1.permissionGuard)('accounting.reports.generalLedger.view'), BankReconciliationController_1.BankReconciliationController.manualMatch);
// Budgets
router.get('/budgets', (0, permissionGuard_1.permissionGuard)('accounting.settings.read'), BudgetController_1.BudgetController.list);
router.post('/budgets', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), BudgetController_1.BudgetController.create);
router.put('/budgets/:id', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), BudgetController_1.BudgetController.update);
router.post('/budgets/:id/approve', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), BudgetController_1.BudgetController.approve);
// Consolidation
router.post('/company-groups', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), ConsolidationController_1.ConsolidationController.createGroup);
router.get('/company-groups', (0, permissionGuard_1.permissionGuard)('accounting.settings.read'), ConsolidationController_1.ConsolidationController.listGroups);
router.get('/reports/consolidated-trial-balance', (0, permissionGuard_1.permissionGuard)('accounting.reports.trialBalance.view'), ConsolidationController_1.ConsolidationController.consolidatedTrialBalance);
// Recurring Vouchers
router.get('/recurring-vouchers', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), RecurringVoucherController_1.RecurringVoucherController.list);
router.post('/recurring-vouchers', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), RecurringVoucherController_1.RecurringVoucherController.create);
router.put('/recurring-vouchers/:id', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), RecurringVoucherController_1.RecurringVoucherController.update);
router.post('/recurring-vouchers/:id/pause', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), RecurringVoucherController_1.RecurringVoucherController.pause);
router.post('/recurring-vouchers/:id/resume', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), RecurringVoucherController_1.RecurringVoucherController.resume);
router.post('/recurring-vouchers/generate', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), RecurringVoucherController_1.RecurringVoucherController.generate);
// Attachments
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.get('/vouchers/:id/attachments', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), AttachmentController_1.AttachmentController.list);
router.post('/vouchers/:id/attachments', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.edit'), upload.single('file'), AttachmentController_1.AttachmentController.upload);
router.get('/vouchers/:id/attachments/:aid', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), AttachmentController_1.AttachmentController.download);
router.delete('/vouchers/:id/attachments/:aid', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.edit'), AttachmentController_1.AttachmentController.remove);
// Designer (Module-specific)
router.get('/designer/voucher-types', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', (0, permissionGuard_1.permissionGuard)('accounting.designer.view'), AccountingDesignerController_1.AccountingDesignerController.getVoucherTypeByCode);
router.post('/designer/voucher-types', (0, permissionGuard_1.permissionGuard)('accounting.designer.create'), AccountingDesignerController_1.AccountingDesignerController.create);
router.put('/designer/voucher-types/:code', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.update);
router.put('/designer/voucher-types/:code/layout', (0, permissionGuard_1.permissionGuard)('accounting.designer.modify'), AccountingDesignerController_1.AccountingDesignerController.saveVoucherTypeLayout);
// Policy Configuration
router.get('/policy-config', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), SettingsController_1.SettingsController.getSettings);
router.put('/policy-config', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), SettingsController_1.SettingsController.updateSettings);
// Fiscal Year Management
router.post('/fiscal-years/:id/reopen-year', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.reopenYear);
router.get('/fiscal-years', (0, permissionGuard_1.permissionGuard)('accounting.settings.read'), FiscalYearController_1.FiscalYearController.list);
router.post('/fiscal-years', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.create);
router.post('/fiscal-years/:id/close-period', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.closePeriod);
router.post('/fiscal-years/:id/reopen-period', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.reopenPeriod);
router.post('/fiscal-years/:id/enable-special-periods', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.enableSpecialPeriods);
router.post('/fiscal-years/:id/close-year', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.closeYear);
router.delete('/fiscal-years/:id', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.delete);
router.post('/fiscal-years/auto-create-retained-earnings', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), FiscalYearController_1.FiscalYearController.autoCreateRetainedEarnings);
// Cost Centers
router.get('/cost-centers', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CostCenterController_1.CostCenterController.list);
router.get('/cost-centers/:id', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CostCenterController_1.CostCenterController.getById);
router.post('/cost-centers', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CostCenterController_1.CostCenterController.create);
router.put('/cost-centers/:id', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CostCenterController_1.CostCenterController.update);
router.delete('/cost-centers/:id', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CostCenterController_1.CostCenterController.deactivate);
// Voucher Sequences
router.get('/voucher-sequences', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), VoucherSequenceController_1.VoucherSequenceController.list);
router.post('/voucher-sequences/next', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), VoucherSequenceController_1.VoucherSequenceController.setNext);
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