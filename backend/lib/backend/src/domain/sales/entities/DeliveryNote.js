"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryNote = void 0;
const DN_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
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
class DeliveryNote {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('DeliveryNote id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('DeliveryNote companyId is required');
        if (!((_c = props.dnNumber) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('DeliveryNote dnNumber is required');
        if (!((_d = props.customerId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('DeliveryNote customerId is required');
        if (!((_e = props.deliveryDate) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('DeliveryNote deliveryDate is required');
        if (!((_f = props.warehouseId) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('DeliveryNote warehouseId is required');
        if (!((_g = props.createdBy) === null || _g === void 0 ? void 0 : _g.trim()))
            throw new Error('DeliveryNote createdBy is required');
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('DeliveryNote must contain at least one line');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.dnNumber = props.dnNumber.trim();
        this.salesOrderId = props.salesOrderId;
        this.customerId = props.customerId.trim();
        this.customerName = props.customerName || '';
        this.deliveryDate = props.deliveryDate;
        this.warehouseId = props.warehouseId.trim();
        this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
        const status = props.status || 'DRAFT';
        if (!DN_STATUSES.includes(status)) {
            throw new Error(`Invalid delivery note status: ${status}`);
        }
        this.status = status;
        this.notes = props.notes;
        this.cogsVoucherId = (_h = props.cogsVoucherId) !== null && _h !== void 0 ? _h : null;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.postedAt = props.postedAt;
    }
    normalizeLine(line, index) {
        var _a, _b, _c, _d, _e, _f;
        if (!((_a = line.lineId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error(`DeliveryNote line ${index + 1}: lineId is required`);
        if (!((_b = line.itemId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error(`DeliveryNote line ${index + 1}: itemId is required`);
        if (line.deliveredQty <= 0 || Number.isNaN(line.deliveredQty)) {
            throw new Error(`DeliveryNote line ${index + 1}: deliveredQty must be greater than 0`);
        }
        if (!((_c = line.uom) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error(`DeliveryNote line ${index + 1}: uom is required`);
        const unitCostBase = roundMoney((_d = line.unitCostBase) !== null && _d !== void 0 ? _d : 0);
        const lineCostBase = roundMoney((_e = line.lineCostBase) !== null && _e !== void 0 ? _e : (line.deliveredQty * unitCostBase));
        return {
            lineId: line.lineId,
            lineNo: line.lineNo || index + 1,
            soLineId: line.soLineId,
            itemId: line.itemId,
            itemCode: line.itemCode || '',
            itemName: line.itemName || '',
            deliveredQty: line.deliveredQty,
            uom: line.uom,
            unitCostBase,
            lineCostBase,
            moveCurrency: (line.moveCurrency || 'USD').toUpperCase().trim(),
            fxRateMovToBase: line.fxRateMovToBase || 1,
            fxRateCCYToBase: line.fxRateCCYToBase || 1,
            stockMovementId: (_f = line.stockMovementId) !== null && _f !== void 0 ? _f : null,
            description: line.description,
        };
    }
    toJSON() {
        var _a;
        return {
            id: this.id,
            companyId: this.companyId,
            dnNumber: this.dnNumber,
            salesOrderId: this.salesOrderId,
            customerId: this.customerId,
            customerName: this.customerName,
            deliveryDate: this.deliveryDate,
            warehouseId: this.warehouseId,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            status: this.status,
            notes: this.notes,
            cogsVoucherId: (_a = this.cogsVoucherId) !== null && _a !== void 0 ? _a : null,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a;
        return new DeliveryNote({
            id: data.id,
            companyId: data.companyId,
            dnNumber: data.dnNumber,
            salesOrderId: data.salesOrderId,
            customerId: data.customerId,
            customerName: data.customerName,
            deliveryDate: data.deliveryDate,
            warehouseId: data.warehouseId,
            lines: data.lines || [],
            status: data.status || 'DRAFT',
            notes: data.notes,
            cogsVoucherId: (_a = data.cogsVoucherId) !== null && _a !== void 0 ? _a : null,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
        });
    }
}
exports.DeliveryNote = DeliveryNote;
//# sourceMappingURL=DeliveryNote.js.map