"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockAdjustment = void 0;
const ADJUSTMENT_REASONS = ['DAMAGE', 'LOSS', 'CORRECTION', 'EXPIRED', 'FOUND', 'OTHER'];
const ADJUSTMENT_STATUSES = ['DRAFT', 'POSTED'];
const toDate = (value) => {
    if (!value)
        return value;
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class StockAdjustment {
    constructor(props) {
        var _a, _b, _c, _d;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('StockAdjustment id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('StockAdjustment companyId is required');
        if (!((_c = props.warehouseId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('StockAdjustment warehouseId is required');
        if (!((_d = props.createdBy) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('StockAdjustment createdBy is required');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
            throw new Error('StockAdjustment date must be in YYYY-MM-DD format');
        }
        if (!ADJUSTMENT_REASONS.includes(props.reason)) {
            throw new Error(`Invalid StockAdjustment reason: ${props.reason}`);
        }
        if (!ADJUSTMENT_STATUSES.includes(props.status)) {
            throw new Error(`Invalid StockAdjustment status: ${props.status}`);
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('StockAdjustment lines are required');
        }
        props.lines.forEach((line, index) => {
            var _a;
            if (!((_a = line.itemId) === null || _a === void 0 ? void 0 : _a.trim())) {
                throw new Error(`StockAdjustment line ${index + 1}: itemId is required`);
            }
            if (Number.isNaN(line.currentQty) || Number.isNaN(line.newQty) || Number.isNaN(line.adjustmentQty)) {
                throw new Error(`StockAdjustment line ${index + 1}: quantity fields must be valid numbers`);
            }
            if (Number.isNaN(line.unitCostBase) || Number.isNaN(line.unitCostCCY)) {
                throw new Error(`StockAdjustment line ${index + 1}: unit costs must be valid numbers`);
            }
        });
        this.id = props.id;
        this.companyId = props.companyId;
        this.warehouseId = props.warehouseId;
        this.date = props.date;
        this.reason = props.reason;
        this.notes = props.notes;
        this.lines = props.lines.map((line) => (Object.assign({}, line)));
        this.status = props.status;
        this.voucherId = props.voucherId;
        this.adjustmentValueBase = props.adjustmentValueBase;
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
            reason: this.reason,
            notes: this.notes,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            status: this.status,
            voucherId: this.voucherId,
            adjustmentValueBase: this.adjustmentValueBase,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a;
        return new StockAdjustment({
            id: data.id,
            companyId: data.companyId,
            warehouseId: data.warehouseId,
            date: data.date,
            reason: data.reason,
            notes: data.notes,
            lines: Array.isArray(data.lines) ? data.lines : [],
            status: data.status || 'DRAFT',
            voucherId: data.voucherId,
            adjustmentValueBase: (_a = data.adjustmentValueBase) !== null && _a !== void 0 ? _a : 0,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt || new Date()),
            postedAt: toDate(data.postedAt),
        });
    }
}
exports.StockAdjustment = StockAdjustment;
//# sourceMappingURL=StockAdjustment.js.map