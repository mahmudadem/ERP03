"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseReturn = void 0;
const PR_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const RETURN_CONTEXTS = ['AFTER_INVOICE', 'BEFORE_INVOICE', 'DIRECT'];
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
class PurchaseReturn {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('PurchaseReturn id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('PurchaseReturn companyId is required');
        if (!((_c = props.returnNumber) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('PurchaseReturn returnNumber is required');
        if (!((_d = props.vendorId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('PurchaseReturn vendorId is required');
        if (!((_e = props.returnDate) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('PurchaseReturn returnDate is required');
        if (!((_f = props.warehouseId) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('PurchaseReturn warehouseId is required');
        if (!((_g = props.currency) === null || _g === void 0 ? void 0 : _g.trim()))
            throw new Error('PurchaseReturn currency is required');
        if (!((_h = props.reason) === null || _h === void 0 ? void 0 : _h.trim()))
            throw new Error('PurchaseReturn reason is required');
        if (!((_j = props.createdBy) === null || _j === void 0 ? void 0 : _j.trim()))
            throw new Error('PurchaseReturn createdBy is required');
        if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
            throw new Error('PurchaseReturn exchangeRate must be greater than 0');
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('PurchaseReturn must contain at least one line');
        }
        if (!RETURN_CONTEXTS.includes(props.returnContext)) {
            throw new Error(`Invalid returnContext: ${props.returnContext}`);
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.returnNumber = props.returnNumber.trim();
        this.purchaseInvoiceId = props.purchaseInvoiceId;
        this.goodsReceiptId = props.goodsReceiptId;
        this.purchaseOrderId = props.purchaseOrderId;
        this.vendorId = props.vendorId.trim();
        this.vendorName = props.vendorName || '';
        this.returnContext = props.returnContext;
        this.returnDate = props.returnDate;
        this.warehouseId = props.warehouseId.trim();
        this.currency = props.currency.toUpperCase().trim();
        this.exchangeRate = props.exchangeRate;
        this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
        this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * line.unitCostDoc), 0));
        this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * line.unitCostBase), 0));
        this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
        this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
        this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
        this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);
        const status = props.status || 'DRAFT';
        if (!PR_STATUSES.includes(status)) {
            throw new Error(`Invalid purchase return status: ${status}`);
        }
        this.status = status;
        this.reason = props.reason.trim();
        this.notes = props.notes;
        this.voucherId = (_k = props.voucherId) !== null && _k !== void 0 ? _k : null;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.postedAt = props.postedAt;
    }
    normalizeLine(line, index) {
        var _a, _b, _c, _d;
        if (!((_a = line.lineId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error(`PurchaseReturn line ${index + 1}: lineId is required`);
        if (!((_b = line.itemId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error(`PurchaseReturn line ${index + 1}: itemId is required`);
        if (line.returnQty <= 0 || Number.isNaN(line.returnQty)) {
            throw new Error(`PurchaseReturn line ${index + 1}: returnQty must be greater than 0`);
        }
        if (!((_c = line.uom) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error(`PurchaseReturn line ${index + 1}: uom is required`);
        if (line.unitCostDoc < 0 || Number.isNaN(line.unitCostDoc)) {
            throw new Error(`PurchaseReturn line ${index + 1}: unitCostDoc must be greater than or equal to 0`);
        }
        const unitCostBase = Number.isNaN(line.unitCostBase)
            ? roundMoney(line.unitCostDoc * this.exchangeRate)
            : roundMoney(line.unitCostBase);
        const taxRate = Number.isNaN(line.taxRate) ? 0 : line.taxRate;
        const lineTotalDoc = roundMoney(line.returnQty * line.unitCostDoc);
        const lineTotalBase = roundMoney(line.returnQty * unitCostBase);
        const taxAmountDoc = roundMoney(line.taxAmountDoc !== undefined ? line.taxAmountDoc : lineTotalDoc * taxRate);
        const taxAmountBase = roundMoney(line.taxAmountBase !== undefined ? line.taxAmountBase : lineTotalBase * taxRate);
        return {
            lineId: line.lineId,
            lineNo: line.lineNo || index + 1,
            piLineId: line.piLineId,
            grnLineId: line.grnLineId,
            poLineId: line.poLineId,
            itemId: line.itemId,
            itemCode: line.itemCode || '',
            itemName: line.itemName || '',
            returnQty: line.returnQty,
            uom: line.uom,
            unitCostDoc: line.unitCostDoc,
            unitCostBase,
            fxRateMovToBase: line.fxRateMovToBase || this.exchangeRate,
            fxRateCCYToBase: line.fxRateCCYToBase || this.exchangeRate,
            taxCodeId: line.taxCodeId,
            taxCode: line.taxCode,
            taxRate,
            taxAmountDoc,
            taxAmountBase,
            accountId: line.accountId,
            stockMovementId: (_d = line.stockMovementId) !== null && _d !== void 0 ? _d : null,
            description: line.description,
        };
    }
    toJSON() {
        var _a;
        return {
            id: this.id,
            companyId: this.companyId,
            returnNumber: this.returnNumber,
            purchaseInvoiceId: this.purchaseInvoiceId,
            goodsReceiptId: this.goodsReceiptId,
            purchaseOrderId: this.purchaseOrderId,
            vendorId: this.vendorId,
            vendorName: this.vendorName,
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
            voucherId: (_a = this.voucherId) !== null && _a !== void 0 ? _a : null,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g;
        return new PurchaseReturn({
            id: data.id,
            companyId: data.companyId,
            returnNumber: data.returnNumber,
            purchaseInvoiceId: data.purchaseInvoiceId,
            goodsReceiptId: data.goodsReceiptId,
            purchaseOrderId: data.purchaseOrderId,
            vendorId: data.vendorId,
            vendorName: data.vendorName,
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
            voucherId: (_g = data.voucherId) !== null && _g !== void 0 ? _g : null,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
        });
    }
}
exports.PurchaseReturn = PurchaseReturn;
//# sourceMappingURL=PurchaseReturn.js.map