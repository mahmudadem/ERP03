
import { Router } from 'express';
import { Router } from 'express';
import { AccountController } from '../controllers/accounting/AccountController';
import { VoucherController } from '../controllers/accounting/VoucherController';
import { ReportingController } from '../controllers/accounting/ReportingController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
router.use(authMiddleware);

// Accounts
router.get('/accounts', AccountController.list);
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

export default router;
