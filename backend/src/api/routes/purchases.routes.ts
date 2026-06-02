import { Router } from 'express';
import { PurchaseController } from '../controllers/purchases/PurchaseController';
import { PurchaseMasterDataController } from '../controllers/purchases/PurchaseMasterDataController';
import { PurchaseInvoiceAttachmentController } from '../controllers/purchases/PurchaseInvoiceAttachmentController';
import { RecordAuditController } from '../controllers/RecordAuditController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { moduleInitializedGuard } from '../middlewares/guards/moduleInitializedGuard';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authMiddleware);

router.post('/initialize', PurchaseController.initializePurchases);
router.get('/settings', PurchaseController.getSettings);

router.use(moduleInitializedGuard('purchase'));

router.put('/settings', PurchaseController.updateSettings);
router.post('/settings/backfill-party-accounts', PurchaseController.backfillPartyAccounts);

router.post('/vendor-groups', PurchaseMasterDataController.createVendorGroup);
router.get('/vendor-groups', PurchaseMasterDataController.listVendorGroups);
router.get('/vendor-groups/:id', PurchaseMasterDataController.getVendorGroup);
router.put('/vendor-groups/:id', PurchaseMasterDataController.updateVendorGroup);
router.delete('/vendor-groups/:id', PurchaseMasterDataController.deleteVendorGroup);
router.post('/vendor-groups/assign', PurchaseMasterDataController.assignVendorToGroup);

// Price Lists
router.post('/price-lists', PurchaseMasterDataController.createPurchasePriceList);
router.get('/price-lists', PurchaseMasterDataController.listPurchasePriceLists);
router.get('/price-lists/effective-price', PurchaseMasterDataController.getEffectivePurchasePrice);
router.get('/price-lists/:id', PurchaseMasterDataController.getPurchasePriceList);
router.put('/price-lists/:id', PurchaseMasterDataController.updatePurchasePriceList);
router.delete('/price-lists/:id', PurchaseMasterDataController.deletePurchasePriceList);


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
router.post('/invoices/:id/approve', idempotencyMiddleware, PurchaseController.approvePI);
router.post('/invoices/:id/unpost', PurchaseController.unpostPI);
router.post('/invoices/:id/payment-update', PurchaseController.updatePaymentStatus);
router.post('/invoices/:id/record-payment', idempotencyMiddleware, PurchaseController.recordPayment);
router.get('/invoices/:id/payments', PurchaseController.getPaymentHistory);
router.get('/invoices/:id/attachments', PurchaseInvoiceAttachmentController.list);
router.post('/invoices/:id/attachments', upload.single('file'), PurchaseInvoiceAttachmentController.upload);
router.get('/invoices/:id/attachments/:aid/link', PurchaseInvoiceAttachmentController.getDownloadLink);
router.delete('/invoices/:id/attachments/:aid', PurchaseInvoiceAttachmentController.remove);

router.get('/reports/vendor-statement', PurchaseController.getVendorStatement);
router.get('/reports/ap-aging', PurchaseController.getApAgingReport);
router.get('/reports/purchases-by-vendor', PurchaseController.getPurchasesByVendor);
router.get('/reports/purchases-by-item', PurchaseController.getPurchasesByItem);
router.get('/vendors/:partyId/statement', PurchaseController.getVendorStatement);

router.post('/returns', PurchaseController.createReturn);
router.get('/returns', PurchaseController.listReturns);
router.get('/returns/:id', PurchaseController.getReturn);
router.put('/returns/:id', PurchaseController.updateReturn);
router.post('/returns/:id/post', idempotencyMiddleware, PurchaseController.postReturn);
router.post('/returns/:id/unpost', PurchaseController.unpostReturn);

router.get('/audit-log', RecordAuditController.getByEntity);

export default router;
