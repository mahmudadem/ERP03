/**
 * accounting.routes.ts (Updated with designer routes)
 */

import { Router } from 'express';
import { AccountController } from '../controllers/accounting/AccountController';
import { VoucherController } from '../controllers/accounting/VoucherController';
import { ReportingController } from '../controllers/accounting/ReportingController';
import { AccountingDesignerController } from '../controllers/accounting/AccountingDesignerController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

// Accounts
router.get('/accounts', AccountController.list);
router.get('/accounts/:id', AccountController.getById);
router.post('/accounts', AccountController.create);
router.put('/accounts/:id', AccountController.update);
router.delete('/accounts/:id', AccountController.deactivate);

// Vouchers
router.get('/vouchers', VoucherController.list);
router.get('/vouchers/:id', VoucherController.get);
router.post('/vouchers', VoucherController.create);
router.put('/vouchers/:id', VoucherController.update);
router.post('/vouchers/:id/approve', VoucherController.approve);
router.post('/vouchers/:id/lock', VoucherController.lock);
router.post('/vouchers/:id/cancel', VoucherController.cancel);

// Reports
router.get('/reports/trial-balance', ReportingController.trialBalance);
router.get('/reports/general-ledger', ReportingController.generalLedger);
router.get('/reports/journal', ReportingController.journal);

// Designer (Module-specific)
router.get('/designer/voucher-types', permissionsMiddleware('accounting.designer.view'), AccountingDesignerController.getVoucherTypes);
router.get('/designer/voucher-types/:code', permissionsMiddleware('accounting.designer.view'), AccountingDesignerController.getVoucherTypeByCode);
router.put('/designer/voucher-types/:code/layout', permissionsMiddleware('accounting.designer.modify'), AccountingDesignerController.saveVoucherTypeLayout);

export default router;
