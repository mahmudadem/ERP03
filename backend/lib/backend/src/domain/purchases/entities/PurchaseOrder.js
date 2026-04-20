"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrder = void 0;
const PO_STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'];
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
class PurchaseOrder {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('PurchaseOrder id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('PurchaseOrder companyId is required');
        if (!((_c = props.orderNumber) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('PurchaseOrder orderNumber is required');
        if (!((_d = props.vendorId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('PurchaseOrder vendorId is required');
        if (!((_e = props.currency) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('PurchaseOrder currency is required');
        if (!((_f = props.createdBy) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('PurchaseOrder createdBy is required');
        if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
            throw new Error('PurchaseOrder exchangeRate must be greater than 0');
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('PurchaseOrder must contain at least one line');
        }
        if (props.status && !PO_STATUSES.includes(props.status)) {
            throw new Error(`Invalid purchase order status: ${props.status}`);
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.orderNumber = props.orderNumber.trim();
        this.vendorId = props.vendorId.trim();
        this.vendorName = props.vendorName || '';
        this.orderDate = props.orderDate;
        this.expectedDeliveryDate = props.expectedDeliveryDate;
        this.currency = props.currency.toUpperCase().trim();
        this.exchangeRate = props.exchangeRate;
        this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
        this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
        this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
        this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
        this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
        this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
        this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);
        this.status = props.status || 'DRAFT';
        this.notes = props.notes;
        this.internalNotes = props.internalNotes;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.confirmedAt = props.confirmedAt;
        this.closedAt = props.closedAt;
    }
    normalizeLine(line, index) {
        var _a, _b, _c, _d, _e, _f;
        if (!((_a = line.itemId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error(`PurchaseOrder line ${index + 1}: itemId is required`);
        if (line.orderedQty <= 0 || Number.isNaN(line.orderedQty)) {
            throw new Error(`PurchaseOrder line ${index + 1}: orderedQty must be greater than 0`);
        }
        if (line.unitPriceDoc < 0 || Number.isNaN(line.unitPriceDoc)) {
            throw new Error(`PurchaseOrder line ${index + 1}: unitPriceDoc must be greater than or equal to 0`);
        }
        const normalizedTaxRate = (_b = line.taxRate) !== null && _b !== void 0 ? _b : 0;
        const lineTotalDoc = roundMoney(line.orderedQty * line.unitPriceDoc);
        const unitPriceBase = roundMoney(line.unitPriceDoc * this.exchangeRate);
        const lineTotalBase = roundMoney(lineTotalDoc * this.exchangeRate);
        const taxAmountDoc = roundMoney(lineTotalDoc * normalizedTaxRate);
        const taxAmountBase = roundMoney(lineTotalBase * normalizedTaxRate);
        return {
            lineId: line.lineId,
            lineNo: (_c = line.lineNo) !== null && _c !== void 0 ? _c : index + 1,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            itemType: line.itemType,
            trackInventory: line.trackInventory,
            orderedQty: line.orderedQty,
            uomId: line.uomId,
            uom: line.uom,
            receivedQty: (_d = line.receivedQty) !== null && _d !== void 0 ? _d : 0,
            invoicedQty: (_e = line.invoicedQty) !== null && _e !== void 0 ? _e : 0,
            returnedQty: (_f = line.returnedQty) !== null && _f !== void 0 ? _f : 0,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc,
            unitPriceBase,
            lineTotalBase,
            taxCodeId: line.taxCodeId,
            taxRate: normalizedTaxRate,
            taxAmountDoc,
            taxAmountBase,
            warehouseId: line.warehouseId,
            description: line.description,
        };
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            orderNumber: this.orderNumber,
            vendorId: this.vendorId,
            vendorName: this.vendorName,
            orderDate: this.orderDate,
            expectedDeliveryDate: this.expectedDeliveryDate,
            currency: this.currency,
            exchangeRate: this.exchangeRate,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            subtotalBase: this.subtotalBase,
            taxTotalBase: this.taxTotalBase,
            grandTotalBase: this.grandTotalBase,
            subtotalDoc: this.subtotalDoc,
            taxTotalDoc: this.taxTotalDoc,
            grandTotalDoc: this.grandTotalDoc,
            status: this.status,
            notes: this.notes,
            internalNotes: this.internalNotes,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            confirmedAt: this.confirmedAt,
            closedAt: this.closedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f;
        return new PurchaseOrder({
            id: data.id,
            companyId: data.companyId,
            orderNumber: data.orderNumber,
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            orderDate: data.orderDate,
            expectedDeliveryDate: data.expectedDeliveryDate,
            currency: data.currency,
            exchangeRate: data.exchangeRate,
            lines: data.lines || [],
            subtotalBase: (_a = data.subtotalBase) !== null && _a !== void 0 ? _a : 0,
            taxTotalBase: (_b = data.taxTotalBase) !== null && _b !== void 0 ? _b : 0,
            grandTotalBase: (_c = data.grandTotalBase) !== null && _c !== void 0 ? _c : 0,
            subtotalDoc: (_d = data.subtotalDoc) !== null && _d !== void 0 ? _d : 0,
            taxTotalDoc: (_e = data.taxTotalDoc) !== null && _e !== void 0 ? _e : 0,
            grandTotalDoc: (_f = data.grandTotalDoc) !== null && _f !== void 0 ? _f : 0,
            status: data.status || 'DRAFT',
            notes: data.notes,
            internalNotes: data.internalNotes,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            confirmedAt: data.confirmedAt ? toDate(data.confirmedAt) : undefined,
            closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
        });
    }
}
exports.PurchaseOrder = PurchaseOrder;
//# sourceMappingURL=PurchaseOrder.js.map