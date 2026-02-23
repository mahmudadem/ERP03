/**
 * accounting.routes.ts (Updated with designer routes)
 */

import { Router } from 'express';
import { AccountController } from '../controllers/accounting/AccountController';
import { VoucherController } from '../controllers/accounting/VoucherController';
import { VoucherFormController } from '../controllers/accounting/VoucherFormController';
import { ReportingController } from '../controllers/accounting/ReportingController';
import { AccountingReportsController } from '../controllers/accounting/AccountingReportsController';
import { AccountingDesignerController } from '../controllers/accounting/AccountingDesignerController';
import { SettingsController } from '../controllers/accounting/SettingsController';
import { CurrencyController } from '../controllers/accounting/CurrencyController';
import { FiscalYearController } from '../controllers/accounting/FiscalYearController';
import { CostCenterController } from '../controllers/accounting/CostCenterController';
import { VoucherSequenceController } from '../controllers/accounting/VoucherSequenceController';
import { BankReconciliationController } from '../controllers/accounting/BankReconciliationController';
import { BudgetController } from '../controllers/accounting/BudgetController';
import { ConsolidationController } from '../controllers/accounting/ConsolidationController';
import { RecurringVoucherController } from '../controllers/accounting/RecurringVoucherController';
import { FXRevaluationController } from '../controllers/accounting/FXRevaluationController';
import { AttachmentController } from '../controllers/accounting/AttachmentController';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';


const router = Router();
// Apply auth and company context middlewares
router.use(authMiddleware);
router.use(companyContextMiddleware);

// Accounts
router.get('/accounts', permissionGuard('accounting.accounts.view'), AccountController.list);
router.get('/accounts/valid', permissionGuard('accounting.vouchers.create'), AccountController.getValid);
router.get('/accounts/resolve/:code', permissionGuard('accounting.vouchers.create'), AccountController.resolveCode);
router.get('/accounts/:id', permissionGuard('accounting.accounts.view'), AccountController.getById);
router.post('/accounts', permissionGuard('accounting.accounts.create'), AccountController.create);
router.put('/accounts/:id', permissionGuard('accounting.accounts.edit'), AccountController.update);
router.delete('/accounts/:id', permissionGuard('accounting.accounts.delete'), AccountController.deactivate);

// Vouchers
router.get('/vouchers', permissionGuard('accounting.vouchers.view'), VoucherController.list);
router.get('/vouchers/pending/approvals', permissionGuard('accounting.vouchers.approve'), VoucherController.getPendingApprovals);
router.get('/vouchers/pending/custody', permissionGuard('accounting.vouchers.view'), VoucherController.getPendingCustody);
router.get('/vouchers/:id', permissionGuard('accounting.vouchers.view'), VoucherController.get);
router.post('/vouchers', 
  permissionGuard('accounting.vouchers.create'), 
  VoucherController.create
);
router.put('/vouchers/:id', permissionGuard('accounting.vouchers.edit'), VoucherController.update);
router.post('/vouchers/:id/approve', permissionGuard('accounting.vouchers.edit'), VoucherController.approve);
router.post('/vouchers/:id/verify', permissionGuard('accounting.vouchers.approve'), VoucherController.verify);
router.post('/vouchers/:id/confirm', permissionGuard('accounting.vouchers.view'), VoucherController.confirm); // V1: View perm + user check in controller
router.post('/vouchers/:id/post', permissionGuard('accounting.vouchers.post'), VoucherController.post);
router.post('/vouchers/:id/correct', permissionGuard('accounting.vouchers.correct'), VoucherController.correct);
router.delete('/vouchers/:id', permissionGuard('accounting.vouchers.delete'), VoucherController.delete);
// router.post('/vouchers/:id/lock', permissionGuard('accounting.vouchers.lock'), VoucherController.lock); // Disabled - not implemented
router.post('/vouchers/:id/reject', permissionGuard('accounting.vouchers.approve'), VoucherController.reject);
router.post('/vouchers/:id/cancel', permissionGuard('accounting.vouchers.cancel'), VoucherController.cancel);

// Reports
router.get('/reports/profit-loss', permissionGuard('accounting.reports.profitAndLoss.view'), ReportingController.profitAndLoss);
router.get('/reports/balance-sheet', permissionGuard('accounting.reports.balanceSheet.view'), AccountingReportsController.getBalanceSheet);
router.get('/reports/trial-balance', permissionGuard('accounting.reports.trialBalance.view'), AccountingReportsController.getTrialBalance);
router.get('/reports/general-ledger', permissionGuard('accounting.reports.generalLedger.view'), AccountingReportsController.getGeneralLedger);
router.get('/reports/account-statement', permissionGuard('accounting.reports.generalLedger.view'), AccountingReportsController.getAccountStatement);
router.get('/reports/journal', permissionGuard('accounting.reports.generalLedger.view'), ReportingController.journal);
router.get('/reports/dashboard-summary', permissionGuard('accounting.vouchers.view'), AccountingReportsController.getDashboardSummary);
router.get('/reports/cash-flow', permissionGuard('accounting.reports.cashFlow.view'), AccountingReportsController.getCashFlow);
router.get('/reports/aging', permissionGuard('accounting.reports.generalLedger.view'), AccountingReportsController.getAgingReport);
router.get('/reports/budget-vs-actual', permissionGuard('accounting.reports.trialBalance.view'), BudgetController.budgetVsActual);
// Bank Reconciliation
router.post('/bank-statements/import', permissionGuard('accounting.reports.generalLedger.view'), BankReconciliationController.import);
router.get('/bank-statements', permissionGuard('accounting.reports.generalLedger.view'), BankReconciliationController.listStatements);
router.get('/reconciliation/:accountId', permissionGuard('accounting.reports.generalLedger.view'), BankReconciliationController.getReconciliation);
router.post('/reconciliation/:accountId/complete', permissionGuard('accounting.reports.generalLedger.view'), BankReconciliationController.complete);
router.post('/reconciliation/match', permissionGuard('accounting.reports.generalLedger.view'), BankReconciliationController.manualMatch);
// Budgets
router.get('/budgets', permissionGuard('accounting.settings.read'), BudgetController.list);
router.post('/budgets', permissionGuard('accounting.settings.write'), BudgetController.create);
router.put('/budgets/:id', permissionGuard('accounting.settings.write'), BudgetController.update);
router.post('/budgets/:id/approve', permissionGuard('accounting.settings.write'), BudgetController.approve);
// Consolidation
router.post('/company-groups', permissionGuard('accounting.settings.write'), ConsolidationController.createGroup);
router.get('/company-groups', permissionGuard('accounting.settings.read'), ConsolidationController.listGroups);
router.get('/reports/consolidated-trial-balance', permissionGuard('accounting.reports.trialBalance.view'), ConsolidationController.consolidatedTrialBalance);
// Recurring Vouchers
router.get('/recurring-vouchers', permissionGuard('accounting.vouchers.view'), RecurringVoucherController.list);
router.post('/recurring-vouchers', permissionGuard('accounting.vouchers.create'), RecurringVoucherController.create);
router.put('/recurring-vouchers/:id', permissionGuard('accounting.vouchers.create'), RecurringVoucherController.update);
router.post('/recurring-vouchers/:id/pause', permissionGuard('accounting.vouchers.create'), RecurringVoucherController.pause);
router.post('/recurring-vouchers/:id/resume', permissionGuard('accounting.vouchers.create'), RecurringVoucherController.resume);
router.post('/recurring-vouchers/generate', permissionGuard('accounting.vouchers.create'), RecurringVoucherController.generate);

// Attachments
const upload = multer({ storage: multer.memoryStorage() });
router.get('/vouchers/:id/attachments', permissionGuard('accounting.vouchers.view'), AttachmentController.list);
router.post('/vouchers/:id/attachments', permissionGuard('accounting.vouchers.edit'), upload.single('file'), AttachmentController.upload);
router.get('/vouchers/:id/attachments/:aid', permissionGuard('accounting.vouchers.view'), AttachmentController.download);
router.delete('/vouchers/:id/attachments/:aid', permissionGuard('accounting.vouchers.edit'), AttachmentController.remove);

// Designer (Module-specific)
router.get('/designer/voucher-types', permissionGuard('accounting.designer.view'), AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', permissionGuard('accounting.designer.view'), AccountingDesignerController.getVoucherTypeByCode);
router.post('/designer/voucher-types', permissionGuard('accounting.designer.create'), AccountingDesignerController.create);
router.put('/designer/voucher-types/:code', permissionGuard('accounting.designer.modify'), AccountingDesignerController.update);
router.put('/designer/voucher-types/:code/layout', permissionGuard('accounting.designer.modify'), AccountingDesignerController.saveVoucherTypeLayout);

// Policy Configuration
router.get('/policy-config', permissionGuard('accounting.vouchers.view'), SettingsController.getSettings);
router.put('/policy-config', permissionGuard('accounting.settings.write'), SettingsController.updateSettings);

// Fiscal Year Management
router.post('/fiscal-years/:id/reopen-year', permissionGuard('accounting.settings.write'), FiscalYearController.reopenYear);
router.get('/fiscal-years', permissionGuard('accounting.settings.read'), FiscalYearController.list);
router.post('/fiscal-years', permissionGuard('accounting.settings.write'), FiscalYearController.create);
router.post('/fiscal-years/:id/close-period', permissionGuard('accounting.settings.write'), FiscalYearController.closePeriod);
router.post('/fiscal-years/:id/reopen-period', permissionGuard('accounting.settings.write'), FiscalYearController.reopenPeriod);
router.post('/fiscal-years/:id/enable-special-periods', permissionGuard('accounting.settings.write'), FiscalYearController.enableSpecialPeriods);
router.post('/fiscal-years/:id/close-year', permissionGuard('accounting.settings.write'), FiscalYearController.closeYear);
router.post('/fiscal-years/:id/commit-year-close', permissionGuard('accounting.settings.write'), FiscalYearController.commitYearClose);
router.delete('/fiscal-years/:id', permissionGuard('accounting.settings.write'), FiscalYearController.delete);
router.post('/fiscal-years/auto-create-retained-earnings', permissionGuard('accounting.settings.write'), FiscalYearController.autoCreateRetainedEarnings);

// Cost Centers
router.get('/cost-centers', permissionGuard('accounting.accounts.view'), CostCenterController.list);
router.get('/cost-centers/:id', permissionGuard('accounting.accounts.view'), CostCenterController.getById);
router.post('/cost-centers', permissionGuard('accounting.settings.write'), CostCenterController.create);
router.put('/cost-centers/:id', permissionGuard('accounting.settings.write'), CostCenterController.update);
router.delete('/cost-centers/:id', permissionGuard('accounting.settings.write'), CostCenterController.deactivate);

// Voucher Sequences
router.get('/voucher-sequences', permissionGuard('accounting.settings.write'), VoucherSequenceController.list);
router.post('/voucher-sequences/next', permissionGuard('accounting.settings.write'), VoucherSequenceController.setNext);

// VoucherForms (UI layouts)
router.get('/voucher-forms', permissionGuard('accounting.designer.view'), VoucherFormController.list);
router.get('/voucher-forms/by-type/:typeId', permissionGuard('accounting.designer.view'), VoucherFormController.getByType);
router.get('/voucher-forms/:id', permissionGuard('accounting.designer.view'), VoucherFormController.getById);
router.post('/voucher-forms', permissionGuard('accounting.designer.create'), VoucherFormController.create);
router.put('/voucher-forms/:id', permissionGuard('accounting.designer.modify'), VoucherFormController.update);
router.delete('/voucher-forms/:id', permissionGuard('accounting.designer.modify'), VoucherFormController.delete);
router.post('/voucher-forms/:id/clone', permissionGuard('accounting.designer.create'), VoucherFormController.clone);

// Currencies
router.get('/currencies', permissionGuard('accounting.accounts.view'), CurrencyController.listCurrencies);
router.get('/currencies/:code', permissionGuard('accounting.accounts.view'), CurrencyController.getCurrency);
router.get('/company/currencies', permissionGuard('accounting.accounts.view'), CurrencyController.listCompanyCurrencies);
router.post('/company/currencies', permissionGuard('accounting.settings.write'), CurrencyController.enableCurrency);
router.delete('/company/currencies/:code', permissionGuard('accounting.settings.write'), CurrencyController.disableCurrency);

// Exchange Rates
router.get('/exchange-rates/history', permissionGuard('accounting.vouchers.view'), CurrencyController.listRateHistory);
router.get('/exchange-rates/matrix', permissionGuard('accounting.accounts.view'), CurrencyController.getLatestRatesMatrix);
router.get('/exchange-rates/suggested', permissionGuard('accounting.vouchers.create'), CurrencyController.getSuggestedRate);
router.post('/exchange-rates', permissionGuard('accounting.vouchers.create'), CurrencyController.saveRate);
router.post('/exchange-rates/check-deviation', permissionGuard('accounting.vouchers.create'), CurrencyController.checkRateDeviation);

// FX Revaluation
router.post('/fx-revaluation/detect-currencies', permissionGuard('accounting.settings.write'), FXRevaluationController.detectCurrencies);
router.post('/fx-revaluation/calculate', permissionGuard('accounting.settings.write'), FXRevaluationController.calculate);
router.post('/fx-revaluation/generate-voucher', permissionGuard('accounting.settings.write'), FXRevaluationController.generateVoucher);

export default router;
