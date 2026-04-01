"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockLevel = void 0;
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class StockLevel {
    constructor(props) {
        var _a, _b, _c, _d;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('StockLevel id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('StockLevel companyId is required');
        if (!((_c = props.itemId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('StockLevel itemId is required');
        if (!((_d = props.warehouseId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('StockLevel warehouseId is required');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(props.maxBusinessDate)) {
            throw new Error('StockLevel maxBusinessDate must be in YYYY-MM-DD format');
        }
        if (props.postingSeq < 0 || Number.isNaN(props.postingSeq)) {
            throw new Error('StockLevel postingSeq must be greater than or equal to 0');
        }
        if (props.version < 0 || Number.isNaN(props.version)) {
            throw new Error('StockLevel version must be greater than or equal to 0');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.itemId = props.itemId;
        this.warehouseId = props.warehouseId;
        this.qtyOnHand = props.qtyOnHand;
        this.reservedQty = props.reservedQty;
        this.avgCostBase = props.avgCostBase;
        this.avgCostCCY = props.avgCostCCY;
        this.lastCostBase = props.lastCostBase;
        this.lastCostCCY = props.lastCostCCY;
        this.postingSeq = props.postingSeq;
        this.maxBusinessDate = props.maxBusinessDate;
        this.totalMovements = props.totalMovements;
        this.lastMovementId = props.lastMovementId;
        this.version = props.version;
        this.updatedAt = props.updatedAt;
    }
    static compositeId(itemId, warehouseId) {
        return `${itemId}_${warehouseId}`;
    }
    static createNew(companyId, itemId, warehouseId, now = new Date()) {
        return new StockLevel({
            id: StockLevel.compositeId(itemId, warehouseId),
            companyId,
            itemId,
            warehouseId,
            qtyOnHand: 0,
            reservedQty: 0,
            avgCostBase: 0,
            avgCostCCY: 0,
            lastCostBase: 0,
            lastCostCCY: 0,
            postingSeq: 0,
            maxBusinessDate: '1970-01-01',
            totalMovements: 0,
            lastMovementId: '',
            version: 0,
            updatedAt: now,
        });
    }
    applyMovementMetadata(movementId, movementDate, now = new Date()) {
        if (!(movementId === null || movementId === void 0 ? void 0 : movementId.trim()))
            throw new Error('movementId is required');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) {
            throw new Error('movementDate must be in YYYY-MM-DD format');
        }
        const oldMaxBusinessDate = this.maxBusinessDate;
        const isBackdated = movementDate < oldMaxBusinessDate;
        this.postingSeq += 1;
        this.version += 1;
        this.totalMovements += 1;
        this.maxBusinessDate = movementDate > oldMaxBusinessDate ? movementDate : oldMaxBusinessDate;
        this.lastMovementId = movementId;
        this.updatedAt = now;
        return { oldMaxBusinessDate, isBackdated };
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            itemId: this.itemId,
            warehouseId: this.warehouseId,
            qtyOnHand: this.qtyOnHand,
            reservedQty: this.reservedQty,
            avgCostBase: this.avgCostBase,
            avgCostCCY: this.avgCostCCY,
            lastCostBase: this.lastCostBase,
            lastCostCCY: this.lastCostCCY,
            postingSeq: this.postingSeq,
            maxBusinessDate: this.maxBusinessDate,
            totalMovements: this.totalMovements,
            lastMovementId: this.lastMovementId,
            version: this.version,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return new StockLevel({
            id: data.id,
            companyId: data.companyId,
            itemId: data.itemId,
            warehouseId: data.warehouseId,
            qtyOnHand: (_a = data.qtyOnHand) !== null && _a !== void 0 ? _a : 0,
            reservedQty: (_b = data.reservedQty) !== null && _b !== void 0 ? _b : 0,
            avgCostBase: (_c = data.avgCostBase) !== null && _c !== void 0 ? _c : 0,
            avgCostCCY: (_d = data.avgCostCCY) !== null && _d !== void 0 ? _d : 0,
            lastCostBase: (_e = data.lastCostBase) !== null && _e !== void 0 ? _e : 0,
            lastCostCCY: (_f = data.lastCostCCY) !== null && _f !== void 0 ? _f : 0,
            postingSeq: (_g = data.postingSeq) !== null && _g !== void 0 ? _g : 0,
            maxBusinessDate: data.maxBusinessDate || '1970-01-01',
            totalMovements: (_h = data.totalMovements) !== null && _h !== void 0 ? _h : 0,
            lastMovementId: data.lastMovementId || '',
            version: (_j = data.version) !== null && _j !== void 0 ? _j : 0,
            updatedAt: toDate(data.updatedAt || new Date()),
        });
    }
}
exports.StockLevel = StockLevel;
//# sourceMappingURL=StockLevel.js.map