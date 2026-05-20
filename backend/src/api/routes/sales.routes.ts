import { Router } from 'express';
import { SalesController } from '../controllers/sales/SalesController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { moduleInitializedGuard } from '../middlewares/guards/moduleInitializedGuard';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware';

const router = Router();
router.use(authMiddleware);

router.post('/initialize', SalesController.initializeSales);
router.get('/settings', SalesController.getSettings);

router.use(moduleInitializedGuard('sales'));

router.put('/settings', SalesController.updateSettings);

router.post('/orders', SalesController.createSO);
router.get('/orders', SalesController.listSOs);
router.get('/orders/:id', SalesController.getSO);
router.get('/orders/:id/invoiceable-linked-source', SalesController.getInvoiceableLinkedSource);
router.put('/orders/:id', SalesController.updateSO);
router.post('/orders/:id/confirm', SalesController.confirmSO);
router.post('/orders/:id/cancel', SalesController.cancelSO);
router.post('/orders/:id/close', SalesController.closeSO);

router.post('/delivery-notes', SalesController.createDN);
router.get('/delivery-notes', SalesController.listDNs);
router.get('/delivery-notes/:id', SalesController.getDN);
router.put('/delivery-notes/:id', SalesController.updateDN);
router.post('/delivery-notes/:id/post', idempotencyMiddleware, SalesController.postDN);

router.post('/invoices', SalesController.createSI);
router.post('/invoices/create-and-post', idempotencyMiddleware, SalesController.createAndPostSI);
router.get('/invoices', SalesController.listSIs);
router.get('/invoices/:id', SalesController.getSI);
router.put('/invoices/:id', SalesController.updateSI);
router.put('/invoices/:id/update-and-post', idempotencyMiddleware, SalesController.updateAndPostSI);
router.post('/invoices/:id/post', idempotencyMiddleware, SalesController.postSI);
router.post('/invoices/:id/payment-status', SalesController.updatePaymentStatus);
router.post('/invoices/:id/record-payment', idempotencyMiddleware, SalesController.recordPayment);
router.get('/invoices/:id/payments', SalesController.getPaymentHistory);

router.post('/returns', SalesController.createReturn);
router.get('/returns', SalesController.listReturns);
router.get('/returns/:id', SalesController.getReturn);
router.put('/returns/:id', SalesController.updateReturn);
router.post('/returns/:id/post', idempotencyMiddleware, SalesController.postReturn);

export default router;
