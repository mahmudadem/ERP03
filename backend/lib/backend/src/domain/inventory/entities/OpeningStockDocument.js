"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpeningStockDocument = void 0;
const OPENING_STOCK_DOCUMENT_STATUSES = ['DRAFT', 'POSTED'];
const toDate = (value) => {
    if (!value)
        return value;
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class OpeningStockDocument {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('OpeningStockDocument id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('OpeningStockDocument companyId is required');
        if (!((_c = props.warehouseId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('OpeningStockDocument warehouseId is required');
        if (!((_d = props.createdBy) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('OpeningStockDocument createdBy is required');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
            throw new Error('OpeningStockDocument date must be in YYYY-MM-DD format');
        }
        if (!OPENING_STOCK_DOCUMENT_STATUSES.includes(props.status)) {
            throw new Error(`Invalid OpeningStockDocument status: ${props.status}`);
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('OpeningStockDocument lines are required');
        }
        props.lines.forEach((line, index) => {
            var _a, _b, _c;
            if (!((_a = line.lineId) === null || _a === void 0 ? void 0 : _a.trim())) {
                throw new Error(`OpeningStockDocument line ${index + 1}: lineId is required`);
            }
            if (!((_b = line.itemId) === null || _b === void 0 ? void 0 : _b.trim())) {
                throw new Error(`OpeningStockDocument line ${index + 1}: itemId is required`);
            }
            if (line.quantity <= 0 || Number.isNaN(line.quantity)) {
                throw new Error(`OpeningStockDocument line ${index + 1}: quantity must be greater than 0`);
            }
            if (line.unitCostInMoveCurrency < 0 || Number.isNaN(line.unitCostInMoveCurrency)) {
                throw new Error(`OpeningStockDocument line ${index + 1}: unitCostInMoveCurrency must be non-negative`);
            }
            if (!((_c = line.moveCurrency) === null || _c === void 0 ? void 0 : _c.trim())) {
                throw new Error(`OpeningStockDocument line ${index + 1}: moveCurrency is required`);
            }
            if (line.fxRateMovToBase <= 0 || Number.isNaN(line.fxRateMovToBase)) {
                throw new Error(`OpeningStockDocument line ${index + 1}: fxRateMovToBase must be greater than 0`);
            }
            if (line.fxRateCCYToBase <= 0 || Number.isNaN(line.fxRateCCYToBase)) {
                throw new Error(`OpeningStockDocument line ${index + 1}: fxRateCCYToBase must be greater than 0`);
            }
            if (line.unitCostBase < 0 || Number.isNaN(line.unitCostBase)) {
                throw new Error(`OpeningStockDocument line ${index + 1}: unitCostBase must be non-negative`);
            }
            if (line.totalValueBase < 0 || Number.isNaN(line.totalValueBase)) {
                throw new Error(`OpeningStockDocument line ${index + 1}: totalValueBase must be non-negative`);
            }
        });
        this.id = props.id;
        this.companyId = props.companyId;
        this.warehouseId = props.warehouseId;
        this.date = props.date;
        this.notes = props.notes;
        this.lines = props.lines.map((line) => (Object.assign(Object.assign({}, line), { moveCurrency: line.moveCurrency.toUpperCase().trim() })));
        this.status = props.status;
        this.createAccountingEffect = props.createAccountingEffect;
        this.openingBalanceAccountId = ((_e = props.openingBalanceAccountId) === null || _e === void 0 ? void 0 : _e.trim()) || undefined;
        this.voucherId = ((_f = props.voucherId) === null || _f === void 0 ? void 0 : _f.trim()) || undefined;
        this.totalValueBase = props.totalValueBase;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.postedAt = props.postedAt;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            warehouseId: this.warehouseId,
            date: this.date,
            notes: this.notes,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            status: this.status,
            createAccountingEffect: this.createAccountingEffect,
            openingBalanceAccountId: this.openingBalanceAccountId,
            voucherId: this.voucherId,
            totalValueBase: this.totalValueBase,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new OpeningStockDocument({
            id: data.id,
            companyId: data.companyId,
            warehouseId: data.warehouseId,
            date: data.date,
            notes: data.notes,
            lines: Array.isArray(data.lines) ? data.lines : [],
            status: data.status || 'DRAFT',
            createAccountingEffect: (_a = data.createAccountingEffect) !== null && _a !== void 0 ? _a : false,
            openingBalanceAccountId: data.openingBalanceAccountId,
            voucherId: data.voucherId,
            totalValueBase: (_b = data.totalValueBase) !== null && _b !== void 0 ? _b : 0,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt || new Date()),
            postedAt: toDate(data.postedAt),
        });
    }
}
exports.OpeningStockDocument = OpeningStockDocument;
//# sourceMappingURL=OpeningStockDocument.js.map