import { Router } from 'express';
import { PurchaseController } from '../controllers/purchases/PurchaseController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { moduleInitializedGuard } from '../middlewares/guards/moduleInitializedGuard';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware';

const router = Router();
router.use(authMiddleware);

router.post('/initialize', PurchaseController.initializePurchases);
router.get('/settings', PurchaseController.getSettings);

router.use(moduleInitializedGuard('purchase'));

router.put('/settings', PurchaseController.updateSettings);
router.post('/settings/backfill-party-accounts', PurchaseController.backfillPartyAccounts);

router.post('/orders', PurchaseController.createPO);
router.get('/orders', PurchaseController.listPOs);
router.get('/orders/:id', PurchaseController.getPO);
router.put('/orders/:id', PurchaseController.updatePO);
router.post('/orders/:id/confirm', PurchaseController.confirmPO);
router.post('/orders/:id/cancel', PurchaseController.cancelPO);
router.post('/orders/:id/close', PurchaseController.closePO);

router.post('/goods-receipts', PurchaseController.createGRN);
router.get('/goods-receipts', PurchaseController.listGRNs);
router.get('/goods-receipts/:id', PurchaseController.getGRN);
router.put('/goods-receipts/:id', PurchaseController.updateGRN);
router.post('/goods-receipts/:id/post', idempotencyMiddleware, PurchaseController.postGRN);
router.post('/goods-receipts/:id/unpost', PurchaseController.unpostGRN);

router.post('/invoices', PurchaseController.createPI);
router.post('/invoices/create-and-post', idempotencyMiddleware, PurchaseController.createAndPostPI);
router.get('/invoices', PurchaseController.listPIs);
router.get('/invoices/:id', PurchaseController.getPI);
router.put('/invoices/:id', PurchaseController.updatePI);
router.put('/invoices/:id/update-and-post', idempotencyMiddleware, PurchaseController.updateAndPostPI);
router.post('/invoices/:id/post', idempotencyMiddleware, PurchaseController.postPI);
router.post('/invoices/:id/unpost', PurchaseController.unpostPI);
router.post('/invoices/:id/payment-update', PurchaseController.updatePaymentStatus);
router.post('/invoices/:id/record-payment', idempotencyMiddleware, PurchaseController.recordPayment);
router.get('/invoices/:id/payments', PurchaseController.getPaymentHistory);

router.post('/returns', PurchaseController.createReturn);
router.get('/returns', PurchaseController.listReturns);
router.get('/returns/:id', PurchaseController.getReturn);
router.put('/returns/:id', PurchaseController.updateReturn);
router.post('/returns/:id/post', idempotencyMiddleware, PurchaseController.postReturn);
router.post('/returns/:id/unpost', PurchaseController.unpostReturn);

export default router;
