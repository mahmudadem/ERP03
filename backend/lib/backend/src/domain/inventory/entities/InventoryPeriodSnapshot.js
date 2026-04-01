"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPeriodSnapshot = void 0;
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class InventoryPeriodSnapshot {
    constructor(props) {
        var _a, _b;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('InventoryPeriodSnapshot id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('InventoryPeriodSnapshot companyId is required');
        if (!/^\d{4}-\d{2}$/.test(props.periodKey)) {
            throw new Error('InventoryPeriodSnapshot periodKey must be in YYYY-MM format');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(props.periodEndDate)) {
            throw new Error('InventoryPeriodSnapshot periodEndDate must be in YYYY-MM-DD format');
        }
        if (!Array.isArray(props.snapshotData)) {
            throw new Error('InventoryPeriodSnapshot snapshotData must be an array');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.periodKey = props.periodKey;
        this.periodEndDate = props.periodEndDate;
        this.snapshotData = props.snapshotData.map((line) => (Object.assign({}, line)));
        this.totalValueBase = props.totalValueBase;
        this.totalItems = props.totalItems;
        this.createdAt = props.createdAt;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            periodKey: this.periodKey,
            periodEndDate: this.periodEndDate,
            snapshotData: this.snapshotData.map((line) => (Object.assign({}, line))),
            totalValueBase: this.totalValueBase,
            totalItems: this.totalItems,
            createdAt: this.createdAt,
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new InventoryPeriodSnapshot({
            id: data.id,
            companyId: data.companyId,
            periodKey: data.periodKey,
            periodEndDate: data.periodEndDate,
            snapshotData: Array.isArray(data.snapshotData) ? data.snapshotData : [],
            totalValueBase: (_a = data.totalValueBase) !== null && _a !== void 0 ? _a : 0,
            totalItems: (_b = data.totalItems) !== null && _b !== void 0 ? _b : 0,
            createdAt: toDate(data.createdAt || new Date()),
        });
    }
}
exports.InventoryPeriodSnapshot = InventoryPeriodSnapshot;
//# sourceMappingURL=InventoryPeriodSnapshot.js.map