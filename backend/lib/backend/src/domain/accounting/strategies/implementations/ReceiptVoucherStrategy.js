"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptVoucherStrategy = void 0;
const VoucherLineEntity_1 = require("../../entities/VoucherLineEntity");
/**
 * ReceiptVoucherStrategy
 *
 * MANY-TO-ONE Structure:
 * - MANY sources (lines with receiveFromAccountId) - receiving from different accounts
 * - ONE destination (depositToAccountId) - the account money goes to
 *
 * Example: Receive 500 TRY from multiple customers to USD CashBox
 * Input:
 * {
 *   depositToAccountId: "acc_cashbox_usd",
 *   currency: "TRY",
 *   exchangeRate: 0.03,
 *   lines: [
 *     { receiveFromAccountId: "acc_customer_ali", amount: 300, notes: "Inv#101" },
 *     { receiveFromAccountId: "acc_customer_fatima", amount: 200, notes: "Inv#102" }
 *   ]
 * }
 */
class ReceiptVoucherStrategy {
    async generateLines(header, companyId, baseCurrency) {
        var _a, _b;
        const lines = [];
        const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const getByKeyCI = (obj, key) => {
            if (!obj || !key)
                return undefined;
            if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '')
                return obj[key];
            const target = key.toLowerCase();
            const found = Object.keys(obj).find(k => k.toLowerCase() === target);
            if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== '') {
                return obj[found];
            }
            const normalizedTarget = normalizeKey(key);
            const foundNormalized = Object.keys(obj).find(k => normalizeKey(k) === normalizedTarget);
            if (foundNormalized && obj[foundNormalized] !== undefined && obj[foundNormalized] !== null && obj[foundNormalized] !== '') {
                return obj[foundNormalized];
            }
            return undefined;
        };
        const extractAccountRef = (value) => {
            if (value === undefined || value === null || value === '')
                return undefined;
            if (typeof value === 'string')
                return value;
            if (typeof value === 'object') {
                if (typeof value.id === 'string' && value.id)
                    return value.id;
                if (typeof value.code === 'string' && value.code)
                    return value.code;
                if (typeof value.accountId === 'string' && value.accountId)
                    return value.accountId;
                if (typeof value.account === 'string' && value.account)
                    return value.account;
            }
            return undefined;
        };
        const resolveAccountId = (obj, primaryKey) => {
            const direct = extractAccountRef(getByKeyCI(obj, primaryKey)) ||
                extractAccountRef(getByKeyCI(obj, 'accountId')) ||
                extractAccountRef(getByKeyCI(obj, 'account'));
            if (direct)
                return direct;
            const metadata = getByKeyCI(obj, 'metadata');
            const metadataDirect = extractAccountRef(getByKeyCI(metadata, primaryKey)) ||
                extractAccountRef(getByKeyCI(metadata, 'accountId')) ||
                extractAccountRef(getByKeyCI(metadata, 'account'));
            if (metadataDirect)
                return metadataDirect;
            const fallbackKey = Object.keys(obj || {}).find(k => normalizeKey(k).includes('account'));
            if (fallbackKey)
                return extractAccountRef(obj[fallbackKey]);
            const metadataFallbackKey = Object.keys(metadata || {}).find(k => normalizeKey(k).includes('account'));
            if (metadataFallbackKey)
                return extractAccountRef(metadata[metadataFallbackKey]);
            return undefined;
        };
        const depositToAccountId = resolveAccountId(header, 'depositToAccountId');
        const headerCurrency = String(header.currency || baseCurrency).toUpperCase();
        const normalizedBaseCurrency = String(baseCurrency).toUpperCase();
        const isHeaderInBaseCurrency = headerCurrency === normalizedBaseCurrency;
        const headerRate = isHeaderInBaseCurrency ? 1 : (Number(header.exchangeRate) || 1);
        const sources = header.lines || [];
        // Compatibility mode: accept canonical JV-style lines (side/accountId/amount)
        // that may come from cloned forms or legacy UI pipelines.
        const canonicalLines = (sources || []).filter((line) => {
            const accountRef = resolveAccountId(line, 'accountId');
            const side = String((line === null || line === void 0 ? void 0 : line.side) || '').toLowerCase();
            const amount = Math.abs(Number(line === null || line === void 0 ? void 0 : line.amount) || 0);
            return !!accountRef && (side === 'debit' || side === 'credit') && amount > 0;
        });
        if (canonicalLines.length > 0 && canonicalLines.length === sources.length) {
            return canonicalLines.map((line, idx) => {
                const accountId = resolveAccountId(line, 'accountId');
                const sideRaw = String(line.side || '').toLowerCase();
                const side = sideRaw === 'credit' ? 'Credit' : 'Debit';
                const amountFx = Math.abs(Number(line.amount) || 0);
                const lineCurrency = String(line.lineCurrency || line.currency || headerCurrency).toUpperCase();
                const lineParity = Number(line.exchangeRate || line.parity || 1);
                const lineRate = lineCurrency === normalizedBaseCurrency
                    ? 1
                    : (lineCurrency === headerCurrency ? headerRate : (0, VoucherLineEntity_1.roundMoney)(headerRate * lineParity));
                const lineBaseCurrency = String(line.baseCurrency || baseCurrency).toUpperCase();
                const baseAmountRaw = Number(line.baseAmount);
                const baseAmount = Number.isFinite(baseAmountRaw) && baseAmountRaw > 0
                    ? (0, VoucherLineEntity_1.roundMoney)(baseAmountRaw)
                    : (0, VoucherLineEntity_1.roundMoney)(amountFx * lineRate);
                return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, accountId, side, baseAmount, lineBaseCurrency, amountFx, lineCurrency, lineRate, line.notes || line.description || '', line.costCenterId || line.costCenter, line.metadata || {});
            });
        }
        if (!depositToAccountId) {
            throw new Error('Receipt requires depositToAccountId (Deposit To account)');
        }
        if (!sources || sources.length === 0) {
            throw new Error('Receipt requires at least one source line');
        }
        let totalFx = 0;
        let totalBaseCalculated = 0;
        const tempLines = [];
        // 1. Generate CREDIT lines for each source first
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const amountFx = Number(source.amount) || 0;
            const lineCurrency = String(source.lineCurrency || source.currency || headerCurrency).toUpperCase();
            const lineParity = Number(source.exchangeRate || source.parity || 1);
            const absoluteRate = lineCurrency === normalizedBaseCurrency
                ? 1
                : (lineCurrency === headerCurrency ? headerRate : (0, VoucherLineEntity_1.roundMoney)(headerRate * lineParity));
            const amountBase = (0, VoucherLineEntity_1.roundMoney)(amountFx * absoluteRate);
            totalFx = (0, VoucherLineEntity_1.roundMoney)(totalFx + amountFx);
            totalBaseCalculated = (0, VoucherLineEntity_1.roundMoney)(totalBaseCalculated + amountBase);
            const sourceAccountId = resolveAccountId(source, 'receiveFromAccountId');
            if (!sourceAccountId) {
                const keys = Object.keys(source || {}).join(', ');
                throw new Error(`Line ${i + 1}: Source must have receiveFromAccountId (received keys: ${keys || 'none'})`);
            }
            const creditLine = new VoucherLineEntity_1.VoucherLineEntity(i + 2, // Leave index 1 for the debit line
            sourceAccountId, 'Credit', amountBase, // baseAmount
            normalizedBaseCurrency, // baseCurrency
            amountFx, // amount
            lineCurrency, // currency
            absoluteRate, source.notes || source.description || 'Receipt source', source.costCenterId || source.costCenter, source.metadata || {});
            tempLines.push(creditLine);
        }
        // 2. Generate single DEBIT line for destination account using SUM OF CREDITS
        const debitCurrency = ((_a = tempLines[0]) === null || _a === void 0 ? void 0 : _a.currency) || headerCurrency;
        const debitRate = debitCurrency === normalizedBaseCurrency
            ? 1
            : (debitCurrency === headerCurrency ? headerRate : Number(((_b = tempLines[0]) === null || _b === void 0 ? void 0 : _b.exchangeRate) || headerRate || 1));
        const debitLine = new VoucherLineEntity_1.VoucherLineEntity(1, depositToAccountId, 'Debit', totalBaseCalculated, // baseAmount (SUM OF CREDITS)
        normalizedBaseCurrency, // baseCurrency
        totalFx, // amount
        debitCurrency, // currency
        debitRate, header.description || 'Receipt deposited', undefined, {});
        lines.push(debitLine);
        lines.push(...tempLines);
        return lines;
    }
}
exports.ReceiptVoucherStrategy = ReceiptVoucherStrategy;
//# sourceMappingURL=ReceiptVoucherStrategy.js.map