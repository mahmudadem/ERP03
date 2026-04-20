"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesReturn = void 0;
const SR_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const RETURN_CONTEXTS = ['AFTER_INVOICE', 'BEFORE_INVOICE'];
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
class SalesReturn {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('SalesReturn id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('SalesReturn companyId is required');
        if (!((_c = props.returnNumber) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('SalesReturn returnNumber is required');
        if (!((_d = props.customerId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('SalesReturn customerId is required');
        if (!((_e = props.returnDate) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('SalesReturn returnDate is required');
        if (!((_f = props.warehouseId) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('SalesReturn warehouseId is required');
        if (!((_g = props.currency) === null || _g === void 0 ? void 0 : _g.trim()))
            throw new Error('SalesReturn currency is required');
        if (!((_h = props.reason) === null || _h === void 0 ? void 0 : _h.trim()))
            throw new Error('SalesReturn reason is required');
        if (!((_j = props.createdBy) === null || _j === void 0 ? void 0 : _j.trim()))
            throw new Error('SalesReturn createdBy is required');
        if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
            throw new Error('SalesReturn exchangeRate must be greater than 0');
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('SalesReturn must contain at least one line');
        }
        if (!RETURN_CONTEXTS.includes(props.returnContext)) {
            throw new Error(`Invalid returnContext: ${props.returnContext}`);
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.returnNumber = props.returnNumber.trim();
        this.salesInvoiceId = props.salesInvoiceId;
        this.deliveryNoteId = props.deliveryNoteId;
        this.salesOrderId = props.salesOrderId;
        this.customerId = props.customerId.trim();
        this.customerName = props.customerName || '';
        this.returnContext = props.returnContext;
        this.returnDate = props.returnDate;
        this.warehouseId = props.warehouseId.trim();
        this.currency = props.currency.toUpperCase().trim();
        this.exchangeRate = props.exchangeRate;
        this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
        this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => { var _a; return sum + roundMoney(line.returnQty * ((_a = line.unitPriceDoc) !== null && _a !== void 0 ? _a : 0)); }, 0));
        this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => { var _a; return sum + roundMoney(line.returnQty * ((_a = line.unitPriceBase) !== null && _a !== void 0 ? _a : 0)); }, 0));
        this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
        this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
        this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
        this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);
        const status = props.status || 'DRAFT';
        if (!SR_STATUSES.includes(status)) {
            throw new Error(`Invalid sales return status: ${status}`);
        }
        this.status = status;
        this.reason = props.reason.trim();
        this.notes = props.notes;
        this.revenueVoucherId = (_k = props.revenueVoucherId) !== null && _k !== void 0 ? _k : null;
        this.cogsVoucherId = (_l = props.cogsVoucherId) !== null && _l !== void 0 ? _l : null;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.postedAt = props.postedAt;
    }
    normalizeLine(line, index) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!((_a = line.lineId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error(`SalesReturn line ${index + 1}: lineId is required`);
        if (!((_b = line.itemId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error(`SalesReturn line ${index + 1}: itemId is required`);
        if (line.returnQty <= 0 || Number.isNaN(line.returnQty)) {
            throw new Error(`SalesReturn line ${index + 1}: returnQty must be greater than 0`);
        }
        if (!((_c = line.uom) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error(`SalesReturn line ${index + 1}: uom is required`);
        const taxRate = Number.isNaN(line.taxRate) ? 0 : line.taxRate;
        const lineTotalDoc = roundMoney(line.returnQty * ((_d = line.unitPriceDoc) !== null && _d !== void 0 ? _d : 0));
        const lineTotalBase = roundMoney(line.returnQty * ((_e = line.unitPriceBase) !== null && _e !== void 0 ? _e : 0));
        return {
            lineId: line.lineId,
            lineNo: line.lineNo || index + 1,
            siLineId: line.siLineId,
            dnLineId: line.dnLineId,
            soLineId: line.soLineId,
            itemId: line.itemId,
            itemCode: line.itemCode || '',
            itemName: line.itemName || '',
            returnQty: line.returnQty,
            uomId: line.uomId,
            uom: line.uom,
            unitPriceDoc: line.unitPriceDoc,
            unitPriceBase: line.unitPriceBase,
            unitCostBase: roundMoney(line.unitCostBase || 0),
            fxRateMovToBase: line.fxRateMovToBase || 1,
            fxRateCCYToBase: line.fxRateCCYToBase || 1,
            taxCodeId: line.taxCodeId,
            taxRate,
            taxAmountDoc: roundMoney((_f = line.taxAmountDoc) !== null && _f !== void 0 ? _f : (lineTotalDoc * taxRate)),
            taxAmountBase: roundMoney((_g = line.taxAmountBase) !== null && _g !== void 0 ? _g : (lineTotalBase * taxRate)),
            revenueAccountId: line.revenueAccountId,
            cogsAccountId: line.cogsAccountId,
            inventoryAccountId: line.inventoryAccountId,
            stockMovementId: (_h = line.stockMovementId) !== null && _h !== void 0 ? _h : null,
            description: line.description,
        };
    }
    toJSON() {
        var _a, _b;
        return {
            id: this.id,
            companyId: this.companyId,
            returnNumber: this.returnNumber,
            salesInvoiceId: this.salesInvoiceId,
            deliveryNoteId: this.deliveryNoteId,
            salesOrderId: this.salesOrderId,
            customerId: this.customerId,
            customerName: this.customerName,
            returnContext: this.returnContext,
            returnDate: this.returnDate,
            warehouseId: this.warehouseId,
            currency: this.currency,
            exchangeRate: this.exchangeRate,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            subtotalDoc: this.subtotalDoc,
            taxTotalDoc: this.taxTotalDoc,
            grandTotalDoc: this.grandTotalDoc,
            subtotalBase: this.subtotalBase,
            taxTotalBase: this.taxTotalBase,
            grandTotalBase: this.grandTotalBase,
            reason: this.reason,
            notes: this.notes,
            status: this.status,
            revenueVoucherId: (_a = this.revenueVoucherId) !== null && _a !== void 0 ? _a : null,
            cogsVoucherId: (_b = this.cogsVoucherId) !== null && _b !== void 0 ? _b : null,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return new SalesReturn({
            id: data.id,
            companyId: data.companyId,
            returnNumber: data.returnNumber,
            salesInvoiceId: data.salesInvoiceId,
            deliveryNoteId: data.deliveryNoteId,
            salesOrderId: data.salesOrderId,
            customerId: data.customerId,
            customerName: data.customerName,
            returnContext: data.returnContext,
            returnDate: data.returnDate,
            warehouseId: data.warehouseId,
            currency: data.currency,
            exchangeRate: data.exchangeRate,
            lines: data.lines || [],
            subtotalDoc: (_a = data.subtotalDoc) !== null && _a !== void 0 ? _a : 0,
            taxTotalDoc: (_b = data.taxTotalDoc) !== null && _b !== void 0 ? _b : 0,
            grandTotalDoc: (_c = data.grandTotalDoc) !== null && _c !== void 0 ? _c : 0,
            subtotalBase: (_d = data.subtotalBase) !== null && _d !== void 0 ? _d : 0,
            taxTotalBase: (_e = data.taxTotalBase) !== null && _e !== void 0 ? _e : 0,
            grandTotalBase: (_f = data.grandTotalBase) !== null && _f !== void 0 ? _f : 0,
            reason: data.reason,
            notes: data.notes,
            status: data.status || 'DRAFT',
            revenueVoucherId: (_g = data.revenueVoucherId) !== null && _g !== void 0 ? _g : null,
            cogsVoucherId: (_h = data.cogsVoucherId) !== null && _h !== void 0 ? _h : null,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
        });
    }
}
exports.SalesReturn = SalesReturn;
//# sourceMappingURL=SalesReturn.js.map