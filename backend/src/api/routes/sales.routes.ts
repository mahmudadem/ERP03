import { Router } from 'express';
import { SalesController } from '../controllers/sales/SalesController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { moduleInitializedGuard } from '../middlewares/guards/moduleInitializedGuard';

const router = Router();
router.use(authMiddleware);

router.post('/initialize', SalesController.initializeSales);
router.get('/settings', SalesController.getSettings);

router.use(moduleInitializedGuard('sales'));

router.put('/settings', SalesController.updateSettings);

router.post('/orders', SalesController.createSO);
router.get('/orders', SalesController.listSOs);
router.get('/orders/:id', SalesController.getSO);
router.put('/orders/:id', SalesController.updateSO);
router.post('/orders/:id/confirm', SalesController.confirmSO);
router.post('/orders/:id/cancel', SalesController.cancelSO);
router.post('/orders/:id/close', SalesController.closeSO);

router.post('/delivery-notes', SalesController.createDN);
router.get('/delivery-notes', SalesController.listDNs);
router.get('/delivery-notes/:id', SalesController.getDN);
router.post('/delivery-notes/:id/post', SalesController.postDN);

router.post('/invoices', SalesController.createSI);
router.get('/invoices', SalesController.listSIs);
router.get('/invoices/:id', SalesController.getSI);
router.put('/invoices/:id', SalesController.updateSI);
router.post('/invoices/:id/post', SalesController.postSI);
router.post('/invoices/:id/payment-status', SalesController.updatePaymentStatus);

router.post('/returns', SalesController.createReturn);
router.get('/returns', SalesController.listReturns);
router.get('/returns/:id', SalesController.getReturn);
router.post('/returns/:id/post', SalesController.postReturn);

export default router;
