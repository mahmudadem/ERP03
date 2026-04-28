/**
 * currency.routes.ts
 * 
 * Shared currency and exchange rate routes - available to all modules.
 * Mounted at /tenant/currencies on the tenant router.
 */

import { Router } from 'express';
import { CurrencyCoreController } from '../controllers/core/CurrencyCoreController';
import { permissionGuard } from '../middlewares/guards/permissionGuard';

const router = Router();

// Currencies - available to all authenticated users with company context
router.get('/currencies', permissionGuard('accounting.accounts.view'), CurrencyCoreController.listCurrencies);
router.get('/currencies/:code', permissionGuard('accounting.accounts.view'), CurrencyCoreController.getCurrency);
router.get('/company/currencies', permissionGuard('accounting.accounts.view'), CurrencyCoreController.listCompanyCurrencies);
router.post('/company/currencies', permissionGuard('accounting.settings.write'), CurrencyCoreController.enableCurrency);
router.delete('/company/currencies/:code', permissionGuard('accounting.settings.write'), CurrencyCoreController.disableCurrency);

// Exchange Rates
router.get('/exchange-rates/history', permissionGuard('accounting.vouchers.view'), CurrencyCoreController.listRateHistory);
router.get('/exchange-rates/matrix', permissionGuard('accounting.accounts.view'), CurrencyCoreController.getLatestRatesMatrix);
router.get('/exchange-rates/suggested', permissionGuard('accounting.vouchers.create'), CurrencyCoreController.getSuggestedRate);
router.post('/exchange-rates', permissionGuard('accounting.vouchers.create'), CurrencyCoreController.saveRate);
router.post('/exchange-rates/check-deviation', permissionGuard('accounting.vouchers.create'), CurrencyCoreController.checkRateDeviation);

export default router;
