
import { Router } from 'express';
import { AccountingController } from '../controllers/accounting/AccountingController';
import { VoucherController } from '../controllers/accounting/VoucherController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

// Accounts
router.post('/accounts', permissionsMiddleware('accounting.accounts.create'), AccountingController.createAccount);

// Vouchers CRUD
router.post('/vouchers', permissionsMiddleware('accounting.vouchers.create'), VoucherController.createVoucher);
router.get('/vouchers', permissionsMiddleware('accounting.vouchers.view'), VoucherController.listVouchers);
router.get('/vouchers/:id', permissionsMiddleware('accounting.vouchers.view'), VoucherController.getVoucher);
router.put('/vouchers/:id', permissionsMiddleware('accounting.vouchers.edit'), VoucherController.updateVoucherDraft);

// Voucher Workflow Actions
router.post('/vouchers/:id/send-to-approval', permissionsMiddleware('accounting.vouchers.edit'), VoucherController.sendToApproval);
router.post('/vouchers/:id/approve', permissionsMiddleware('accounting.vouchers.approve'), VoucherController.approveVoucher);
router.post('/vouchers/:id/lock', permissionsMiddleware('accounting.vouchers.lock'), VoucherController.lockVoucher);
router.post('/vouchers/:id/cancel', permissionsMiddleware('accounting.vouchers.cancel'), VoucherController.cancelVoucher);

export default router;
