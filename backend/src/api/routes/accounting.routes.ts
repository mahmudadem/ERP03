/**
 * accounting.routes.ts (Updated with designer routes)
 */

import { Router } from 'express';
import { AccountController } from '../controllers/accounting/AccountController';
import { VoucherController } from '../controllers/accounting/VoucherController';
import { VoucherFormController } from '../controllers/accounting/VoucherFormController';
import { ReportingController } from '../controllers/accounting/ReportingController';
import { AccountingDesignerController } from '../controllers/accounting/AccountingDesignerController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';


const router = Router();
// authMiddleware should be applied at tenant router level, but keeping here for safety if mounted elsewhere
router.use(authMiddleware);

// Accounts
router.get('/accounts', permissionGuard('accounting.account.view'), AccountController.list);
router.get('/accounts/valid', permissionGuard('accounting.voucher.create'), AccountController.getValid);
router.get('/accounts/resolve/:code', permissionGuard('accounting.voucher.create'), AccountController.resolveCode);
router.get('/accounts/:id', permissionGuard('accounting.account.view'), AccountController.getById);
router.post('/accounts', permissionGuard('accounting.account.create'), AccountController.create);
router.put('/accounts/:id', permissionGuard('accounting.account.edit'), AccountController.update);
router.delete('/accounts/:id', permissionGuard('accounting.account.delete'), AccountController.deactivate);

// Vouchers
router.get('/vouchers', permissionGuard('accounting.voucher.view'), VoucherController.list);
router.get('/vouchers/:id', permissionGuard('accounting.voucher.view'), VoucherController.get);
router.post('/vouchers', 
  permissionGuard('accounting.voucher.create'), 
  VoucherController.create
);
router.put('/vouchers/:id', permissionGuard('accounting.voucher.edit'), VoucherController.update);
router.post('/vouchers/:id/approve', permissionGuard('accounting.voucher.approve'), VoucherController.approve);
router.post('/vouchers/:id/lock', permissionGuard('accounting.voucher.lock'), VoucherController.lock);
router.post('/vouchers/:id/cancel', permissionGuard('accounting.voucher.cancel'), VoucherController.cancel);

// Reports
router.get('/reports/profit-loss', permissionGuard('accounting.reports.profitAndLoss.view'), ReportingController.profitAndLoss);
router.get('/reports/trial-balance', permissionGuard('accounting.report.view'), ReportingController.trialBalance);
router.get('/reports/general-ledger', permissionGuard('accounting.report.view'), ReportingController.generalLedger);
router.get('/reports/journal', permissionGuard('accounting.report.view'), ReportingController.journal);

// Designer (Module-specific)
router.get('/designer/voucher-types', permissionGuard('accounting.designer.view'), AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', permissionGuard('accounting.designer.view'), AccountingDesignerController.getVoucherTypeByCode);
router.post('/designer/voucher-types', permissionGuard('accounting.designer.create'), AccountingDesignerController.create);
router.put('/designer/voucher-types/:code', permissionGuard('accounting.designer.modify'), AccountingDesignerController.update);
router.put('/designer/voucher-types/:code/layout', permissionGuard('accounting.designer.modify'), AccountingDesignerController.saveVoucherTypeLayout);

// VoucherForms (UI layouts)
router.get('/voucher-forms', permissionGuard('accounting.designer.view'), VoucherFormController.list);
router.get('/voucher-forms/by-type/:typeId', permissionGuard('accounting.designer.view'), VoucherFormController.getByType);
router.get('/voucher-forms/:id', permissionGuard('accounting.designer.view'), VoucherFormController.getById);
router.post('/voucher-forms', permissionGuard('accounting.designer.create'), VoucherFormController.create);
router.put('/voucher-forms/:id', permissionGuard('accounting.designer.modify'), VoucherFormController.update);
router.delete('/voucher-forms/:id', permissionGuard('accounting.designer.modify'), VoucherFormController.delete);
router.post('/voucher-forms/:id/clone', permissionGuard('accounting.designer.create'), VoucherFormController.clone);

export default router;
