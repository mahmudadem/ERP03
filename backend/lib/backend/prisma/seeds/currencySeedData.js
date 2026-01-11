"use strict";
/**
 * ISO 4217 Currency Seed Data
 *
 * Standard currencies with correct decimal precision.
 * - Most currencies: 2 decimals
 * - JPY, KRW, etc.: 0 decimals
 * - BHD, KWD, OMR: 3 decimals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecimalPlaces = exports.getCurrencyByCode = exports.CURRENCY_SEED_DATA = void 0;
exports.CURRENCY_SEED_DATA = [
    // Major currencies
    { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
    { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimalPlaces: 2 },
    { code: 'CAD', name: 'Canadian Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'AUD', name: 'Australian Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 },
    // Middle East currencies
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', decimalPlaces: 2 },
    { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', decimalPlaces: 2 },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimalPlaces: 3 },
    { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', decimalPlaces: 3 },
    { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimalPlaces: 3 },
    { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', decimalPlaces: 3 },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', decimalPlaces: 2 },
    // Turkish Lira
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimalPlaces: 2 },
    // Other major currencies
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimalPlaces: 0 },
    { code: 'SGD', name: 'Singapore Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimalPlaces: 2 },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimalPlaces: 2 },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimalPlaces: 2 },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimalPlaces: 2 },
    { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimalPlaces: 2 },
    { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimalPlaces: 2 },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimalPlaces: 2 },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimalPlaces: 2 },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2 },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalPlaces: 2 },
];
/**
 * Get currency by code
 */
function getCurrencyByCode(code) {
    return exports.CURRENCY_SEED_DATA.find(c => c.code === code.toUpperCase());
}
exports.getCurrencyByCode = getCurrencyByCode;
/**
 * Get decimal places for a currency code
 * Returns 2 as default for unknown currencies
 */
function getDecimalPlaces(code) {
    var _a;
    const currency = getCurrencyByCode(code);
    return (_a = currency === null || currency === void 0 ? void 0 : currency.decimalPlaces) !== null && _a !== void 0 ? _a : 2;
}
exports.getDecimalPlaces = getDecimalPlaces;
//# sourceMappingURL=currencySeedData.js.map