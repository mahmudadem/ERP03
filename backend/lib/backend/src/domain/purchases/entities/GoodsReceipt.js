"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoodsReceipt = void 0;
const GRN_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const toDate = (value) => {
    if (!value)
        return new Date();
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class GoodsReceipt {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('GoodsReceipt id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('GoodsReceipt companyId is required');
        if (!((_c = props.grnNumber) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('GoodsReceipt grnNumber is required');
        if (!((_d = props.vendorId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('GoodsReceipt vendorId is required');
        if (!((_e = props.receiptDate) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('GoodsReceipt receiptDate is required');
        if (!((_f = props.warehouseId) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('GoodsReceipt warehouseId is required');
        if (!((_g = props.createdBy) === null || _g === void 0 ? void 0 : _g.trim()))
            throw new Error('GoodsReceipt createdBy is required');
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('GoodsReceipt must contain at least one line');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.grnNumber = props.grnNumber.trim();
        this.purchaseOrderId = props.purchaseOrderId;
        this.vendorId = props.vendorId.trim();
        this.vendorName = props.vendorName || '';
        this.receiptDate = props.receiptDate;
        this.warehouseId = props.warehouseId.trim();
        this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
        const status = props.status || 'DRAFT';
        if (!GRN_STATUSES.includes(status)) {
            throw new Error(`Invalid goods receipt status: ${status}`);
        }
        this.status = status;
        this.notes = props.notes;
        this.voucherId = (_h = props.voucherId) !== null && _h !== void 0 ? _h : null;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.postedAt = props.postedAt;
    }
    normalizeLine(line, index) {
        var _a, _b, _c, _d, _e;
        if (!((_a = line.lineId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error(`GoodsReceipt line ${index + 1}: lineId is required`);
        if (!((_b = line.itemId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error(`GoodsReceipt line ${index + 1}: itemId is required`);
        if (line.receivedQty <= 0 || Number.isNaN(line.receivedQty)) {
            throw new Error(`GoodsReceipt line ${index + 1}: receivedQty must be greater than 0`);
        }
        if (!((_c = line.uom) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error(`GoodsReceipt line ${index + 1}: uom is required`);
        if (!((_d = line.moveCurrency) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error(`GoodsReceipt line ${index + 1}: moveCurrency is required`);
        if (line.unitCostDoc < 0 || Number.isNaN(line.unitCostDoc)) {
            throw new Error(`GoodsReceipt line ${index + 1}: unitCostDoc must be greater than or equal to 0`);
        }
        if (line.fxRateMovToBase <= 0 || Number.isNaN(line.fxRateMovToBase)) {
            throw new Error(`GoodsReceipt line ${index + 1}: fxRateMovToBase must be greater than 0`);
        }
        if (line.fxRateCCYToBase <= 0 || Number.isNaN(line.fxRateCCYToBase)) {
            throw new Error(`GoodsReceipt line ${index + 1}: fxRateCCYToBase must be greater than 0`);
        }
        return {
            lineId: line.lineId,
            lineNo: line.lineNo || index + 1,
            poLineId: line.poLineId,
            itemId: line.itemId,
            itemCode: line.itemCode || '',
            itemName: line.itemName || '',
            receivedQty: line.receivedQty,
            uomId: line.uomId,
            uom: line.uom,
            unitCostDoc: line.unitCostDoc,
            unitCostBase: roundMoney(line.unitCostBase),
            moveCurrency: line.moveCurrency.toUpperCase().trim(),
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            stockMovementId: (_e = line.stockMovementId) !== null && _e !== void 0 ? _e : null,
            description: line.description,
        };
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            grnNumber: this.grnNumber,
            purchaseOrderId: this.purchaseOrderId,
            vendorId: this.vendorId,
            vendorName: this.vendorName,
            receiptDate: this.receiptDate,
            warehouseId: this.warehouseId,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            status: this.status,
            notes: this.notes,
            voucherId: this.voucherId,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a;
        return new GoodsReceipt({
            id: data.id,
            companyId: data.companyId,
            grnNumber: data.grnNumber,
            purchaseOrderId: data.purchaseOrderId,
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            receiptDate: data.receiptDate,
            warehouseId: data.warehouseId,
            lines: data.lines || [],
            status: data.status || 'DRAFT',
            notes: data.notes,
            voucherId: (_a = data.voucherId) !== null && _a !== void 0 ? _a : null,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
        });
    }
}
exports.GoodsReceipt = GoodsReceipt;
//# sourceMappingURL=GoodsReceipt.js.map