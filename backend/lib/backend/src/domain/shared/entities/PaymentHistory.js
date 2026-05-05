"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentHistory = void 0;
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const SOURCE_TYPES = ['SALES_INVOICE', 'PURCHASE_INVOICE'];
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const toDate = (value) => {
    if (!value)
        return new Date();
    if (value instanceof Date)
        return value;
    if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate();
    }
    return new Date(String(value));
};
const toStr = (value) => {
    if (value === undefined || value === null || value === '')
        return '';
    if (typeof value === 'object') {
        const obj = value;
        for (const key of ['id', 'value', 'code', 'key', 'uid', 'uuid']) {
            const c = obj[key];
            if (c !== undefined && c !== null && c !== '')
                return String(c).trim();
        }
        return '';
    }
    return String(value).trim();
};
class PaymentHistory {
    constructor(props) {
        var _a, _b, _c;
        const id = toStr(props.id);
        const companyId = toStr(props.companyId);
        const sourceType = toStr(props.sourceType);
        const sourceId = toStr(props.sourceId);
        const sourceNumber = toStr(props.sourceNumber);
        const currency = toStr(props.currency);
        const createdBy = toStr(props.createdBy);
        const paymentMethod = toStr(props.paymentMethod);
        const paymentDate = toStr(props.paymentDate);
        if (!id)
            throw new Error('PaymentHistory id is required');
        if (!companyId)
            throw new Error('PaymentHistory companyId is required');
        if (!SOURCE_TYPES.includes(sourceType))
            throw new Error(`Invalid PaymentHistory sourceType: ${sourceType}`);
        if (!sourceId)
            throw new Error('PaymentHistory sourceId is required');
        if (!sourceNumber)
            throw new Error('PaymentHistory sourceNumber is required');
        if (!currency)
            throw new Error('PaymentHistory currency is required');
        if (!createdBy)
            throw new Error('PaymentHistory createdBy is required');
        if (!PAYMENT_METHODS.includes(paymentMethod))
            throw new Error(`Invalid PaymentHistory paymentMethod: ${paymentMethod}`);
        if (!paymentDate)
            throw new Error('PaymentHistory paymentDate is required');
        const amountBase = Number(props.amountBase);
        const amountDoc = Number((_a = props.amountDoc) !== null && _a !== void 0 ? _a : props.amountBase);
        const exchangeRate = Number((_b = props.exchangeRate) !== null && _b !== void 0 ? _b : 1);
        if (amountBase <= 0 || Number.isNaN(amountBase))
            throw new Error('PaymentHistory amountBase must be positive');
        if (exchangeRate <= 0 || Number.isNaN(exchangeRate))
            throw new Error('PaymentHistory exchangeRate must be > 0');
        this.id = id;
        this.companyId = companyId;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.sourceNumber = sourceNumber;
        this.amountBase = roundMoney(amountBase);
        this.currency = currency.toUpperCase();
        this.exchangeRate = exchangeRate;
        this.amountDoc = roundMoney(amountDoc);
        this.paymentDate = paymentDate;
        this.paymentMethod = paymentMethod;
        this.reference = props.reference || undefined;
        this.notes = props.notes || undefined;
        this.voucherId = (_c = props.voucherId) !== null && _c !== void 0 ? _c : null;
        this.createdBy = createdBy;
        this.createdAt = props.createdAt;
    }
    toJSON() {
        var _a, _b, _c;
        return {
            id: this.id,
            companyId: this.companyId,
            sourceType: this.sourceType,
            sourceId: this.sourceId,
            sourceNumber: this.sourceNumber,
            amountBase: this.amountBase,
            currency: this.currency,
            exchangeRate: this.exchangeRate,
            amountDoc: this.amountDoc,
            paymentDate: this.paymentDate,
            paymentMethod: this.paymentMethod,
            reference: (_a = this.reference) !== null && _a !== void 0 ? _a : null,
            notes: (_b = this.notes) !== null && _b !== void 0 ? _b : null,
            voucherId: (_c = this.voucherId) !== null && _c !== void 0 ? _c : null,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c;
        return new PaymentHistory({
            id: data.id,
            companyId: data.companyId,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            sourceNumber: data.sourceNumber,
            amountBase: Number(data.amountBase),
            currency: data.currency,
            exchangeRate: Number((_a = data.exchangeRate) !== null && _a !== void 0 ? _a : 1),
            amountDoc: Number((_b = data.amountDoc) !== null && _b !== void 0 ? _b : data.amountBase),
            paymentDate: data.paymentDate,
            paymentMethod: data.paymentMethod,
            reference: data.reference || undefined,
            notes: data.notes || undefined,
            voucherId: (_c = data.voucherId) !== null && _c !== void 0 ? _c : null,
            createdBy: data.createdBy,
            createdAt: toDate(data.createdAt),
        });
    }
}
exports.PaymentHistory = PaymentHistory;
//# sourceMappingURL=PaymentHistory.js.map