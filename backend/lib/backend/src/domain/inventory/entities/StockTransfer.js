"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockTransfer = void 0;
const TRANSFER_STATUSES = ['DRAFT', 'IN_TRANSIT', 'COMPLETED'];
const toDate = (value) => {
    if (!value)
        return value;
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class StockTransfer {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('StockTransfer id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('StockTransfer companyId is required');
        if (!((_c = props.sourceWarehouseId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('StockTransfer sourceWarehouseId is required');
        if (!((_d = props.destinationWarehouseId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('StockTransfer destinationWarehouseId is required');
        if (props.sourceWarehouseId === props.destinationWarehouseId) {
            throw new Error('StockTransfer sourceWarehouseId and destinationWarehouseId must be different');
        }
        if (!((_e = props.transferPairId) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('StockTransfer transferPairId is required');
        if (!((_f = props.createdBy) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('StockTransfer createdBy is required');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
            throw new Error('StockTransfer date must be in YYYY-MM-DD format');
        }
        if (!TRANSFER_STATUSES.includes(props.status)) {
            throw new Error(`Invalid StockTransfer status: ${props.status}`);
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('StockTransfer lines are required');
        }
        props.lines.forEach((line, index) => {
            var _a;
            if (!((_a = line.itemId) === null || _a === void 0 ? void 0 : _a.trim())) {
                throw new Error(`StockTransfer line ${index + 1}: itemId is required`);
            }
            if (line.qty <= 0 || Number.isNaN(line.qty)) {
                throw new Error(`StockTransfer line ${index + 1}: qty must be greater than 0`);
            }
            if (Number.isNaN(line.unitCostBaseAtTransfer) || Number.isNaN(line.unitCostCCYAtTransfer)) {
                throw new Error(`StockTransfer line ${index + 1}: unit costs must be valid numbers`);
            }
        });
        this.id = props.id;
        this.companyId = props.companyId;
        this.sourceWarehouseId = props.sourceWarehouseId;
        this.destinationWarehouseId = props.destinationWarehouseId;
        this.date = props.date;
        this.notes = props.notes;
        this.lines = props.lines.map((line) => (Object.assign({}, line)));
        this.status = props.status;
        this.transferPairId = props.transferPairId;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.completedAt = props.completedAt;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            sourceWarehouseId: this.sourceWarehouseId,
            destinationWarehouseId: this.destinationWarehouseId,
            date: this.date,
            notes: this.notes,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            status: this.status,
            transferPairId: this.transferPairId,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            completedAt: this.completedAt,
        };
    }
    static fromJSON(data) {
        return new StockTransfer({
            id: data.id,
            companyId: data.companyId,
            sourceWarehouseId: data.sourceWarehouseId,
            destinationWarehouseId: data.destinationWarehouseId,
            date: data.date,
            notes: data.notes,
            lines: Array.isArray(data.lines) ? data.lines : [],
            status: data.status || 'DRAFT',
            transferPairId: data.transferPairId || data.id,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt || new Date()),
            completedAt: toDate(data.completedAt),
        });
    }
}
exports.StockTransfer = StockTransfer;
//# sourceMappingURL=StockTransfer.js.map