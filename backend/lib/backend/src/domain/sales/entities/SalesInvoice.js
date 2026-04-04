"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesInvoice = void 0;
const SI_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
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
class SalesInvoice {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('SalesInvoice id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('SalesInvoice companyId is required');
        if (!((_c = props.invoiceNumber) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('SalesInvoice invoiceNumber is required');
        if (!((_d = props.customerId) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('SalesInvoice customerId is required');
        if (!((_e = props.invoiceDate) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('SalesInvoice invoiceDate is required');
        if (!((_f = props.currency) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('SalesInvoice currency is required');
        if (!((_g = props.createdBy) === null || _g === void 0 ? void 0 : _g.trim()))
            throw new Error('SalesInvoice createdBy is required');
        if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
            throw new Error('SalesInvoice exchangeRate must be greater than 0');
        }
        if (!Array.isArray(props.lines) || props.lines.length === 0) {
            throw new Error('SalesInvoice must contain at least one line');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.invoiceNumber = props.invoiceNumber.trim();
        this.customerInvoiceNumber = props.customerInvoiceNumber;
        this.salesOrderId = props.salesOrderId;
        this.customerId = props.customerId.trim();
        this.customerName = props.customerName || '';
        this.invoiceDate = props.invoiceDate;
        this.dueDate = props.dueDate;
        this.currency = props.currency.toUpperCase().trim();
        this.exchangeRate = props.exchangeRate;
        this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
        this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
        this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
        this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
        this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
        this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
        this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);
        this.paymentTermsDays = (_h = props.paymentTermsDays) !== null && _h !== void 0 ? _h : 0;
        this.paidAmountBase = (_j = props.paidAmountBase) !== null && _j !== void 0 ? _j : 0;
        const status = props.status || 'DRAFT';
        if (!SI_STATUSES.includes(status)) {
            throw new Error(`Invalid sales invoice status: ${status}`);
        }
        this.status = status;
        const paymentStatus = props.paymentStatus || 'UNPAID';
        if (!PAYMENT_STATUSES.includes(paymentStatus)) {
            throw new Error(`Invalid sales invoice paymentStatus: ${paymentStatus}`);
        }
        this.paymentStatus = paymentStatus;
        this.outstandingAmountBase = roundMoney(props.outstandingAmountBase !== undefined
            ? props.outstandingAmountBase
            : this.grandTotalBase - this.paidAmountBase);
        this.voucherId = (_k = props.voucherId) !== null && _k !== void 0 ? _k : null;
        this.cogsVoucherId = (_l = props.cogsVoucherId) !== null && _l !== void 0 ? _l : null;
        this.notes = props.notes;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.postedAt = props.postedAt;
    }
    normalizeLine(line, index) {
        var _a, _b, _c, _d;
        if (!((_a = line.lineId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error(`SalesInvoice line ${index + 1}: lineId is required`);
        if (!((_b = line.itemId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error(`SalesInvoice line ${index + 1}: itemId is required`);
        if (line.invoicedQty <= 0 || Number.isNaN(line.invoicedQty)) {
            throw new Error(`SalesInvoice line ${index + 1}: invoicedQty must be greater than 0`);
        }
        if (!((_c = line.uom) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error(`SalesInvoice line ${index + 1}: uom is required`);
        if (line.unitPriceDoc < 0 || Number.isNaN(line.unitPriceDoc)) {
            throw new Error(`SalesInvoice line ${index + 1}: unitPriceDoc must be greater than or equal to 0`);
        }
        const taxRate = Number.isNaN(line.taxRate) ? 0 : line.taxRate;
        const lineTotalDoc = roundMoney(line.invoicedQty * line.unitPriceDoc);
        const unitPriceBase = roundMoney(line.unitPriceDoc * this.exchangeRate);
        const lineTotalBase = roundMoney(lineTotalDoc * this.exchangeRate);
        const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
        const taxAmountBase = roundMoney(lineTotalBase * taxRate);
        return {
            lineId: line.lineId,
            lineNo: line.lineNo || index + 1,
            soLineId: line.soLineId,
            dnLineId: line.dnLineId,
            itemId: line.itemId,
            itemCode: line.itemCode || '',
            itemName: line.itemName || '',
            trackInventory: !!line.trackInventory,
            invoicedQty: line.invoicedQty,
            uom: line.uom,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc,
            unitPriceBase,
            lineTotalBase,
            taxCodeId: line.taxCodeId,
            taxCode: line.taxCode,
            taxRate,
            taxAmountDoc,
            taxAmountBase,
            warehouseId: line.warehouseId,
            revenueAccountId: line.revenueAccountId || '',
            cogsAccountId: line.cogsAccountId,
            inventoryAccountId: line.inventoryAccountId,
            unitCostBase: line.unitCostBase,
            lineCostBase: line.lineCostBase,
            stockMovementId: (_d = line.stockMovementId) !== null && _d !== void 0 ? _d : null,
            description: line.description,
        };
    }
    toJSON() {
        var _a, _b;
        return {
            id: this.id,
            companyId: this.companyId,
            invoiceNumber: this.invoiceNumber,
            customerInvoiceNumber: this.customerInvoiceNumber,
            salesOrderId: this.salesOrderId,
            customerId: this.customerId,
            customerName: this.customerName,
            invoiceDate: this.invoiceDate,
            dueDate: this.dueDate,
            currency: this.currency,
            exchangeRate: this.exchangeRate,
            lines: this.lines.map((line) => (Object.assign({}, line))),
            subtotalDoc: this.subtotalDoc,
            taxTotalDoc: this.taxTotalDoc,
            grandTotalDoc: this.grandTotalDoc,
            subtotalBase: this.subtotalBase,
            taxTotalBase: this.taxTotalBase,
            grandTotalBase: this.grandTotalBase,
            paymentTermsDays: this.paymentTermsDays,
            paymentStatus: this.paymentStatus,
            paidAmountBase: this.paidAmountBase,
            outstandingAmountBase: this.outstandingAmountBase,
            status: this.status,
            voucherId: (_a = this.voucherId) !== null && _a !== void 0 ? _a : null,
            cogsVoucherId: (_b = this.cogsVoucherId) !== null && _b !== void 0 ? _b : null,
            notes: this.notes,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            postedAt: this.postedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return new SalesInvoice({
            id: data.id,
            companyId: data.companyId,
            invoiceNumber: data.invoiceNumber,
            customerInvoiceNumber: data.customerInvoiceNumber,
            salesOrderId: data.salesOrderId,
            customerId: data.customerId,
            customerName: data.customerName,
            invoiceDate: data.invoiceDate,
            dueDate: data.dueDate,
            currency: data.currency,
            exchangeRate: data.exchangeRate,
            lines: data.lines || [],
            subtotalDoc: (_a = data.subtotalDoc) !== null && _a !== void 0 ? _a : 0,
            taxTotalDoc: (_b = data.taxTotalDoc) !== null && _b !== void 0 ? _b : 0,
            grandTotalDoc: (_c = data.grandTotalDoc) !== null && _c !== void 0 ? _c : 0,
            subtotalBase: (_d = data.subtotalBase) !== null && _d !== void 0 ? _d : 0,
            taxTotalBase: (_e = data.taxTotalBase) !== null && _e !== void 0 ? _e : 0,
            grandTotalBase: (_f = data.grandTotalBase) !== null && _f !== void 0 ? _f : 0,
            paymentTermsDays: (_g = data.paymentTermsDays) !== null && _g !== void 0 ? _g : 0,
            paymentStatus: data.paymentStatus || 'UNPAID',
            paidAmountBase: (_h = data.paidAmountBase) !== null && _h !== void 0 ? _h : 0,
            outstandingAmountBase: (_j = data.outstandingAmountBase) !== null && _j !== void 0 ? _j : 0,
            status: data.status || 'DRAFT',
            voucherId: (_k = data.voucherId) !== null && _k !== void 0 ? _k : null,
            cogsVoucherId: (_l = data.cogsVoucherId) !== null && _l !== void 0 ? _l : null,
            notes: data.notes,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
        });
    }
}
exports.SalesInvoice = SalesInvoice;
//# sourceMappingURL=SalesInvoice.js.map