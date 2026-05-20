import { Router } from 'express';
import { SalesController } from '../controllers/sales/SalesController';
import { SalesMasterDataController } from '../controllers/sales/SalesMasterDataController';
import { SalesOperationalController } from '../controllers/sales/SalesOperationalController';
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

// Price Lists
router.post('/price-lists', SalesMasterDataController.createPriceList);
router.get('/price-lists', SalesMasterDataController.listPriceLists);
router.get('/price-lists/effective-price', SalesMasterDataController.getEffectivePrice);
router.get('/price-lists/:id', SalesMasterDataController.getPriceList);
router.put('/price-lists/:id', SalesMasterDataController.updatePriceList);
router.delete('/price-lists/:id', SalesMasterDataController.deletePriceList);

// Customer Groups
router.post('/customer-groups', SalesMasterDataController.createCustomerGroup);
router.get('/customer-groups', SalesMasterDataController.listCustomerGroups);
router.get('/customer-groups/:id', SalesMasterDataController.getCustomerGroup);
router.put('/customer-groups/:id', SalesMasterDataController.updateCustomerGroup);
router.delete('/customer-groups/:id', SalesMasterDataController.deleteCustomerGroup);
router.post('/customer-groups/assign', SalesMasterDataController.assignCustomerToGroup);

// Salespersons
router.post('/salespersons', SalesMasterDataController.createSalesperson);
router.get('/salespersons', SalesMasterDataController.listSalespersons);
router.get('/salespersons/:id', SalesMasterDataController.getSalesperson);
router.put('/salespersons/:id', SalesMasterDataController.updateSalesperson);
router.delete('/salespersons/:id', SalesMasterDataController.deleteSalesperson);

// Commissions
router.post('/commissions/accrue', SalesMasterDataController.accrueCommission);
router.get('/commissions', SalesMasterDataController.listCommissions);
router.get('/commissions/totals/:salespersonId', SalesMasterDataController.getSalespersonCommissionTotals);
router.get('/commissions/:id', SalesMasterDataController.getCommissionEntry);
router.post('/commissions/:id/mark-paid', SalesMasterDataController.markCommissionPaid);
router.post('/commissions/:id/cancel', SalesMasterDataController.cancelCommission);

// Quotations
router.post('/quotes', SalesOperationalController.createQuote);
router.get('/quotes', SalesOperationalController.listQuotes);
router.get('/quotes/:id', SalesOperationalController.getQuote);
router.put('/quotes/:id', SalesOperationalController.updateQuote);
router.delete('/quotes/:id', SalesOperationalController.deleteQuote);
router.post('/quotes/:id/send', SalesOperationalController.sendQuote);
router.post('/quotes/:id/accept', SalesOperationalController.acceptQuote);
router.post('/quotes/:id/reject', SalesOperationalController.rejectQuote);
router.post('/quotes/:id/revise', SalesOperationalController.reviseQuote);
router.post('/quotes/:id/convert-to-order', SalesOperationalController.convertQuoteToSalesOrder);
router.post('/quotes/:id/convert-to-invoice', SalesOperationalController.convertQuoteToSalesInvoice);

// Promotions
router.post('/promotions', SalesOperationalController.createPromotionRule);
router.get('/promotions', SalesOperationalController.listPromotionRules);
router.post('/promotions/evaluate', SalesOperationalController.evaluatePromotions);
router.get('/promotions/:id', SalesOperationalController.getPromotionRule);
router.put('/promotions/:id', SalesOperationalController.updatePromotionRule);
router.delete('/promotions/:id', SalesOperationalController.deletePromotionRule);

// Credit overrides + delivery scheduling
router.get('/credit-overrides', SalesOperationalController.listCreditOverrides);
router.get('/aged-backlog', SalesOperationalController.getAgedBacklog);

export default router;
