"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSubledgerDocumentLines = void 0;
const VoucherLineEntity_1 = require("../../entities/VoucherLineEntity");
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeSide = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'debit')
        return 'Debit';
    if (normalized === 'credit')
        return 'Credit';
    throw new Error(`Invalid voucher line side: ${value}`);
};
const requirePositive = (value, fieldName, lineNo) => {
    if (value <= 0) {
        throw new Error(`Line ${lineNo}: ${fieldName} must be greater than 0`);
    }
    return value;
};
const resolveCurrency = (line, headerCurrency, baseCurrency) => {
    const raw = (line === null || line === void 0 ? void 0 : line.currency) || (line === null || line === void 0 ? void 0 : line.docCurrency) || (line === null || line === void 0 ? void 0 : line.lineCurrency) || headerCurrency || baseCurrency;
    return String(raw || baseCurrency).toUpperCase();
};
const resolveExchangeRate = (line, defaultRate) => {
    const rate = toNumber((line === null || line === void 0 ? void 0 : line.exchangeRate) || (line === null || line === void 0 ? void 0 : line.effectiveRate) || (line === null || line === void 0 ? void 0 : line.rate) || defaultRate);
    if (rate <= 0)
        return defaultRate > 0 ? defaultRate : 1;
    return rate;
};
const resolveAmounts = (line, lineCurrency, baseCurrency, headerRate, lineNo) => {
    var _a, _b, _c;
    let baseAmount = Math.abs(toNumber((_a = line === null || line === void 0 ? void 0 : line.baseAmount) !== null && _a !== void 0 ? _a : line === null || line === void 0 ? void 0 : line.amountBase));
    let docAmount = Math.abs(toNumber((_c = (_b = line === null || line === void 0 ? void 0 : line.docAmount) !== null && _b !== void 0 ? _b : line === null || line === void 0 ? void 0 : line.amount) !== null && _c !== void 0 ? _c : line === null || line === void 0 ? void 0 : line.amountDoc));
    let exchangeRate = 1;
    if (lineCurrency === baseCurrency) {
        if (baseAmount <= 0 && docAmount <= 0) {
            throw new Error(`Line ${lineNo}: amount is required`);
        }
        if (baseAmount <= 0)
            baseAmount = docAmount;
        if (docAmount <= 0)
            docAmount = baseAmount;
        exchangeRate = 1;
    }
    else {
        exchangeRate = resolveExchangeRate(line, headerRate);
        if (baseAmount <= 0 && docAmount <= 0) {
            throw new Error(`Line ${lineNo}: baseAmount or docAmount is required`);
        }
        if (docAmount <= 0) {
            docAmount = baseAmount / exchangeRate;
        }
        if (baseAmount <= 0) {
            baseAmount = docAmount * exchangeRate;
        }
    }
    baseAmount = (0, VoucherLineEntity_1.roundMoney)(requirePositive(baseAmount, 'baseAmount', lineNo));
    docAmount = (0, VoucherLineEntity_1.roundMoney)(requirePositive(docAmount, 'docAmount', lineNo));
    exchangeRate = lineCurrency === baseCurrency ? 1 : (0, VoucherLineEntity_1.roundMoney)(requirePositive(exchangeRate, 'exchangeRate', lineNo));
    return { baseAmount, docAmount, exchangeRate };
};
const generateSubledgerDocumentLines = async (header, baseCurrencyRaw) => {
    const baseCurrency = String(baseCurrencyRaw || '').toUpperCase();
    const headerCurrency = String((header === null || header === void 0 ? void 0 : header.currency) || baseCurrency).toUpperCase();
    const parsedHeaderRate = toNumber(header === null || header === void 0 ? void 0 : header.exchangeRate);
    const headerRate = headerCurrency === baseCurrency ? 1 : (parsedHeaderRate > 0 ? parsedHeaderRate : 1);
    const inputLines = Array.isArray(header === null || header === void 0 ? void 0 : header.lines) ? header.lines : [];
    if (!inputLines.length) {
        throw new Error('Subledger voucher requires at least one line');
    }
    return inputLines.map((line, idx) => {
        const lineNo = idx + 1;
        const accountId = String((line === null || line === void 0 ? void 0 : line.accountId) || '').trim();
        if (!accountId) {
            throw new Error(`Line ${lineNo}: accountId is required`);
        }
        const side = normalizeSide(line === null || line === void 0 ? void 0 : line.side);
        const lineCurrency = resolveCurrency(line, headerCurrency, baseCurrency);
        const { baseAmount, docAmount, exchangeRate } = resolveAmounts(line, lineCurrency, baseCurrency, headerRate, lineNo);
        return new VoucherLineEntity_1.VoucherLineEntity(lineNo, accountId, side, baseAmount, baseCurrency, docAmount, lineCurrency, exchangeRate, (line === null || line === void 0 ? void 0 : line.notes) || (line === null || line === void 0 ? void 0 : line.description) || '', (line === null || line === void 0 ? void 0 : line.costCenterId) || (line === null || line === void 0 ? void 0 : line.costCenter), (line === null || line === void 0 ? void 0 : line.metadata) || {});
    });
};
exports.generateSubledgerDocumentLines = generateSubledgerDocumentLines;
//# sourceMappingURL=SubledgerDocumentStrategyHelper.js.map