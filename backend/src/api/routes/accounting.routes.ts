/**
 * accounting.routes.ts (Updated with designer routes)
 */

import { Router } from 'express';
import { AccountController } from '../controllers/accounting/AccountController';
import { VoucherController } from '../controllers/accounting/VoucherController';
import { VoucherFormController } from '../controllers/accounting/VoucherFormController';
import { ReportingController } from '../controllers/accounting/ReportingController';
import { AccountingDesignerController } from '../controllers/accounting/AccountingDesignerController';
import { SettingsController } from '../controllers/accounting/SettingsController';
import { CurrencyController } from '../controllers/accounting/CurrencyController';
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
router.get('/vouchers/:id', permissionGuard('accounting.vouchers.view'), VoucherController.get);
router.post('/vouchers', 
  permissionGuard('accounting.vouchers.create'), 
  VoucherController.create
);
router.put('/vouchers/:id', permissionGuard('accounting.vouchers.edit'), VoucherController.update);
router.post('/vouchers/:id/approve', permissionGuard('accounting.vouchers.approve'), VoucherController.approve);
router.post('/vouchers/:id/verify', permissionGuard('accounting.vouchers.approve'), VoucherController.verify);
router.post('/vouchers/:id/post', permissionGuard('accounting.vouchers.post'), VoucherController.post);
router.post('/vouchers/:id/correct', permissionGuard('accounting.vouchers.correct'), VoucherController.correct);
router.delete('/vouchers/:id', permissionGuard('accounting.vouchers.delete'), VoucherController.delete);
// router.post('/vouchers/:id/lock', permissionGuard('accounting.vouchers.lock'), VoucherController.lock); // Disabled - not implemented
router.post('/vouchers/:id/reject', permissionGuard('accounting.vouchers.approve'), VoucherController.reject);
router.post('/vouchers/:id/cancel', permissionGuard('accounting.vouchers.cancel'), VoucherController.cancel);

// Reports
router.get('/reports/profit-loss', permissionGuard('accounting.reports.profitAndLoss.view'), ReportingController.profitAndLoss);
router.get('/reports/trial-balance', permissionGuard('accounting.reports.trialBalance.view'), ReportingController.trialBalance);
router.get('/reports/general-ledger', permissionGuard('accounting.reports.generalLedger.view'), ReportingController.generalLedger);
router.get('/reports/journal', permissionGuard('accounting.reports.generalLedger.view'), ReportingController.journal);

// Designer (Module-specific)
router.get('/designer/voucher-types', permissionGuard('accounting.designer.view'), AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', permissionGuard('accounting.designer.view'), AccountingDesignerController.getVoucherTypeByCode);
router.post('/designer/voucher-types', permissionGuard('accounting.designer.create'), AccountingDesignerController.create);
router.put('/designer/voucher-types/:code', permissionGuard('accounting.designer.modify'), AccountingDesignerController.update);
router.put('/designer/voucher-types/:code/layout', permissionGuard('accounting.designer.modify'), AccountingDesignerController.saveVoucherTypeLayout);

// Policy Configuration
router.get('/policy-config', permissionGuard('accounting.settings.read'), SettingsController.getSettings);
router.put('/policy-config', permissionGuard('accounting.settings.write'), SettingsController.updateSettings);

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
router.get('/exchange-rates/suggested', permissionGuard('accounting.vouchers.create'), CurrencyController.getSuggestedRate);
router.post('/exchange-rates', permissionGuard('accounting.vouchers.create'), CurrencyController.saveRate);
router.post('/exchange-rates/check-deviation', permissionGuard('accounting.vouchers.create'), CurrencyController.checkRateDeviation);

export default router;
