"use strict";
/**
 * currency.routes.ts
 *
 * Shared currency and exchange rate routes - available to all modules.
 * Mounted at /tenant/currencies on the tenant router.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CurrencyCoreController_1 = require("../controllers/core/CurrencyCoreController");
const permissionGuard_1 = require("../middlewares/guards/permissionGuard");
const router = (0, express_1.Router)();
// Currencies - available to all authenticated users with company context
router.get('/', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyCoreController_1.CurrencyCoreController.listCurrencies);
router.get('/:code', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyCoreController_1.CurrencyCoreController.getCurrency);
router.get('/company/currencies', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyCoreController_1.CurrencyCoreController.listCompanyCurrencies);
router.post('/company/currencies', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CurrencyCoreController_1.CurrencyCoreController.enableCurrency);
router.delete('/company/currencies/:code', (0, permissionGuard_1.permissionGuard)('accounting.settings.write'), CurrencyCoreController_1.CurrencyCoreController.disableCurrency);
// Exchange Rates
router.get('/exchange-rates/history', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.view'), CurrencyCoreController_1.CurrencyCoreController.listRateHistory);
router.get('/exchange-rates/matrix', (0, permissionGuard_1.permissionGuard)('accounting.accounts.view'), CurrencyCoreController_1.CurrencyCoreController.getLatestRatesMatrix);
router.get('/exchange-rates/suggested', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), CurrencyCoreController_1.CurrencyCoreController.getSuggestedRate);
router.post('/exchange-rates', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), CurrencyCoreController_1.CurrencyCoreController.saveRate);
router.post('/exchange-rates/check-deviation', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.create'), CurrencyCoreController_1.CurrencyCoreController.checkRateDeviation);
exports.default = router;
//# sourceMappingURL=currency.routes.js.map