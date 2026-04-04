"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovement = void 0;
const VoucherLineEntity_1 = require("../../accounting/entities/VoucherLineEntity");
const MOVEMENT_TYPES = [
    'PURCHASE_RECEIPT',
    'SALES_DELIVERY',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'OPENING_STOCK',
    'RETURN_IN',
    'RETURN_OUT',
];
const REFERENCE_TYPES = [
    'PURCHASE_INVOICE',
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'PURCHASE_RETURN',
    'SALES_ORDER',
    'DELIVERY_NOTE',
    'SALES_INVOICE',
    'SALES_RETURN',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'OPENING',
    'MANUAL',
];
const COST_SOURCES = [
    'PURCHASE',
    'OPENING',
    'ADJUSTMENT',
    'TRANSFER',
    'RETURN',
    'SETTLEMENT',
];
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class StockMovement {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('StockMovement id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('StockMovement companyId is required');
        if (!((_c = props.itemId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('StockMovement itemId is required');
        if (!((_d = props.warehouseId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('StockMovement warehouseId is required');
        if (!((_e = props.createdBy) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('StockMovement createdBy is required');
        if (!((_f = props.uom) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('StockMovement uom is required');
        if (!((_g = props.movementCurrency) === null || _g === void 0 ? void 0 : _g.trim()))
            throw new Error('StockMovement movementCurrency is required');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
            throw new Error('StockMovement date must be in YYYY-MM-DD format');
        }
        if (!MOVEMENT_TYPES.includes(props.movementType)) {
            throw new Error(`Invalid movementType: ${props.movementType}`);
        }
        if (!REFERENCE_TYPES.includes(props.referenceType)) {
            throw new Error(`Invalid referenceType: ${props.referenceType}`);
        }
        if (!COST_SOURCES.includes(props.costSource)) {
            throw new Error(`Invalid costSource: ${props.costSource}`);
        }
        if (props.direction !== 'IN' && props.direction !== 'OUT') {
            throw new Error(`Invalid direction: ${props.direction}`);
        }
        if (props.qty <= 0 || Number.isNaN(props.qty)) {
            throw new Error('StockMovement qty must be greater than 0');
        }
        if (props.postingSeq <= 0 || Number.isNaN(props.postingSeq)) {
            throw new Error('StockMovement postingSeq must be greater than 0');
        }
        if (props.fxRateMovToBase <= 0 || Number.isNaN(props.fxRateMovToBase)) {
            throw new Error('StockMovement fxRateMovToBase must be greater than 0');
        }
        if (props.fxRateCCYToBase <= 0 || Number.isNaN(props.fxRateCCYToBase)) {
            throw new Error('StockMovement fxRateCCYToBase must be greater than 0');
        }
        const expectedBase = (0, VoucherLineEntity_1.roundMoney)(props.unitCostBase * props.qty);
        if (Math.abs(expectedBase - props.totalCostBase) > 0.0001) {
            throw new Error('StockMovement totalCostBase does not match roundMoney(unitCostBase * qty)');
        }
        const expectedCCY = (0, VoucherLineEntity_1.roundMoney)(props.unitCostCCY * props.qty);
        if (Math.abs(expectedCCY - props.totalCostCCY) > 0.0001) {
            throw new Error('StockMovement totalCostCCY does not match roundMoney(unitCostCCY * qty)');
        }
        const isTransfer = props.movementType === 'TRANSFER_IN' || props.movementType === 'TRANSFER_OUT';
        if (isTransfer && !props.transferPairId) {
            throw new Error('StockMovement transferPairId is required for transfer movements');
        }
        if (!isTransfer && props.transferPairId) {
            throw new Error('StockMovement transferPairId is only allowed for transfer movements');
        }
        const isReturn = props.movementType === 'RETURN_IN' || props.movementType === 'RETURN_OUT';
        if (!isReturn && props.reversesMovementId) {
            throw new Error('StockMovement reversesMovementId is only allowed for return movements');
        }
        if (props.direction === 'OUT') {
            if (props.settledQty === undefined || props.unsettledQty === undefined) {
                throw new Error('OUT movement requires settledQty and unsettledQty');
            }
            if (props.settlesNegativeQty !== undefined || props.newPositiveQty !== undefined) {
                throw new Error('OUT movement cannot include IN settlement fields');
            }
            if (props.settledQty < 0 || props.unsettledQty < 0) {
                throw new Error('OUT settlement quantities cannot be negative');
            }
            if (Math.abs(props.settledQty + props.unsettledQty - props.qty) > 0.0001) {
                throw new Error('OUT settledQty + unsettledQty must equal qty');
            }
        }
        if (props.direction === 'IN') {
            if (props.settlesNegativeQty === undefined || props.newPositiveQty === undefined) {
                throw new Error('IN movement requires settlesNegativeQty and newPositiveQty');
            }
            if (props.settledQty !== undefined || props.unsettledQty !== undefined || props.unsettledCostBasis !== undefined) {
                throw new Error('IN movement cannot include OUT settlement fields');
            }
            if (props.settlesNegativeQty < 0 || props.newPositiveQty < 0) {
                throw new Error('IN settlement quantities cannot be negative');
            }
            if (Math.abs(props.settlesNegativeQty + props.newPositiveQty - props.qty) > 0.0001) {
                throw new Error('IN settlesNegativeQty + newPositiveQty must equal qty');
            }
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.date = props.date;
        this.postingSeq = props.postingSeq;
        this.createdAt = props.createdAt;
        this.createdBy = props.createdBy;
        this.postedAt = props.postedAt;
        this.itemId = props.itemId;
        this.warehouseId = props.warehouseId;
        this.direction = props.direction;
        this.movementType = props.movementType;
        this.qty = props.qty;
        this.uom = props.uom;
        this.referenceType = props.referenceType;
        this.referenceId = props.referenceId;
        this.referenceLineId = props.referenceLineId;
        this.reversesMovementId = props.reversesMovementId;
        this.transferPairId = props.transferPairId;
        this.unitCostBase = props.unitCostBase;
        this.totalCostBase = props.totalCostBase;
        this.unitCostCCY = props.unitCostCCY;
        this.totalCostCCY = props.totalCostCCY;
        this.movementCurrency = props.movementCurrency;
        this.fxRateMovToBase = props.fxRateMovToBase;
        this.fxRateCCYToBase = props.fxRateCCYToBase;
        this.fxRateKind = props.fxRateKind;
        this.avgCostBaseAfter = props.avgCostBaseAfter;
        this.avgCostCCYAfter = props.avgCostCCYAfter;
        this.qtyBefore = props.qtyBefore;
        this.qtyAfter = props.qtyAfter;
        this.settledQty = props.settledQty;
        this.unsettledQty = props.unsettledQty;
        this.unsettledCostBasis = props.unsettledCostBasis;
        this.settlesNegativeQty = props.settlesNegativeQty;
        this.newPositiveQty = props.newPositiveQty;
        this.negativeQtyAtPosting = props.negativeQtyAtPosting;
        this.costSettled = props.costSettled;
        this.isBackdated = props.isBackdated;
        this.costSource = props.costSource;
        this.notes = props.notes;
        this.metadata = props.metadata;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            date: this.date,
            postingSeq: this.postingSeq,
            createdAt: this.createdAt,
            createdBy: this.createdBy,
            postedAt: this.postedAt,
            itemId: this.itemId,
            warehouseId: this.warehouseId,
            direction: this.direction,
            movementType: this.movementType,
            qty: this.qty,
            uom: this.uom,
            referenceType: this.referenceType,
            referenceId: this.referenceId,
            referenceLineId: this.referenceLineId,
            reversesMovementId: this.reversesMovementId,
            transferPairId: this.transferPairId,
            unitCostBase: this.unitCostBase,
            totalCostBase: this.totalCostBase,
            unitCostCCY: this.unitCostCCY,
            totalCostCCY: this.totalCostCCY,
            movementCurrency: this.movementCurrency,
            fxRateMovToBase: this.fxRateMovToBase,
            fxRateCCYToBase: this.fxRateCCYToBase,
            fxRateKind: this.fxRateKind,
            avgCostBaseAfter: this.avgCostBaseAfter,
            avgCostCCYAfter: this.avgCostCCYAfter,
            qtyBefore: this.qtyBefore,
            qtyAfter: this.qtyAfter,
            settledQty: this.settledQty,
            unsettledQty: this.unsettledQty,
            unsettledCostBasis: this.unsettledCostBasis,
            settlesNegativeQty: this.settlesNegativeQty,
            newPositiveQty: this.newPositiveQty,
            negativeQtyAtPosting: this.negativeQtyAtPosting,
            costSettled: this.costSettled,
            isBackdated: this.isBackdated,
            costSource: this.costSource,
            notes: this.notes,
            metadata: this.metadata,
        };
    }
    static fromJSON(data) {
        return new StockMovement({
            id: data.id,
            companyId: data.companyId,
            date: data.date,
            postingSeq: data.postingSeq,
            createdAt: toDate(data.createdAt || new Date()),
            createdBy: data.createdBy || 'SYSTEM',
            postedAt: toDate(data.postedAt || new Date()),
            itemId: data.itemId,
            warehouseId: data.warehouseId,
            direction: data.direction,
            movementType: data.movementType,
            qty: data.qty,
            uom: data.uom,
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            referenceLineId: data.referenceLineId,
            reversesMovementId: data.reversesMovementId,
            transferPairId: data.transferPairId,
            unitCostBase: data.unitCostBase,
            totalCostBase: data.totalCostBase,
            unitCostCCY: data.unitCostCCY,
            totalCostCCY: data.totalCostCCY,
            movementCurrency: data.movementCurrency,
            fxRateMovToBase: data.fxRateMovToBase,
            fxRateCCYToBase: data.fxRateCCYToBase,
            fxRateKind: data.fxRateKind,
            avgCostBaseAfter: data.avgCostBaseAfter,
            avgCostCCYAfter: data.avgCostCCYAfter,
            qtyBefore: data.qtyBefore,
            qtyAfter: data.qtyAfter,
            settledQty: data.settledQty,
            unsettledQty: data.unsettledQty,
            unsettledCostBasis: data.unsettledCostBasis,
            settlesNegativeQty: data.settlesNegativeQty,
            newPositiveQty: data.newPositiveQty,
            negativeQtyAtPosting: data.negativeQtyAtPosting,
            costSettled: data.costSettled,
            isBackdated: data.isBackdated,
            costSource: data.costSource,
            notes: data.notes,
            metadata: data.metadata,
        });
    }
}
exports.StockMovement = StockMovement;
//# sourceMappingURL=StockMovement.js.map