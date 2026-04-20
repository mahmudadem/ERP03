"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSalesOrdersUseCase = exports.GetSalesOrderUseCase = exports.CloseSalesOrderUseCase = exports.CancelSalesOrderUseCase = exports.ConfirmSalesOrderUseCase = exports.UpdateSalesOrderUseCase = exports.CreateSalesOrderUseCase = exports.generateUniqueDocumentNumber = exports.generateDocumentNumber = void 0;
const crypto_1 = require("crypto");
const SalesOrder_1 = require("../../../domain/sales/entities/SalesOrder");
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const generateDocumentNumber = (settings, docType) => {
    let prefix = '';
    let seq = 1;
    if (docType === 'SO') {
        prefix = settings.soNumberPrefix;
        seq = settings.soNumberNextSeq;
        settings.soNumberNextSeq += 1;
    }
    else if (docType === 'DN') {
        prefix = settings.dnNumberPrefix;
        seq = settings.dnNumberNextSeq;
        settings.dnNumberNextSeq += 1;
    }
    else if (docType === 'SI') {
        prefix = settings.siNumberPrefix;
        seq = settings.siNumberNextSeq;
        settings.siNumberNextSeq += 1;
    }
    else {
        prefix = settings.srNumberPrefix;
        seq = settings.srNumberNextSeq;
        settings.srNumberNextSeq += 1;
    }
    return `${prefix}-${String(seq).padStart(5, '0')}`;
};
exports.generateDocumentNumber = generateDocumentNumber;
const generateUniqueDocumentNumber = async (settings, docType, exists) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const candidate = (0, exports.generateDocumentNumber)(settings, docType);
        if (!(await exists(candidate))) {
            return candidate;
        }
    }
    throw new Error(`Unable to allocate a unique ${docType} document number`);
};
exports.generateUniqueDocumentNumber = generateUniqueDocumentNumber;
const assertValidSalesTaxCode = (taxCode, taxCodeId) => {
    if (!taxCode.active || (taxCode.scope !== 'SALES' && taxCode.scope !== 'BOTH')) {
        throw new Error(`Tax code is not valid for sales: ${taxCodeId}`);
    }
};
class CreateSalesOrderUseCase {
    constructor(settingsRepo, salesOrderRepo, partyRepo, itemRepo, taxCodeRepo, companyCurrencyRepo) {
        this.settingsRepo = settingsRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(input) {
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const customer = await this.partyRepo.getById(input.companyId, input.customerId);
        this.assertCustomer(customer, input.customerId);
        const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.currency);
        if (!currencyEnabled) {
            throw new Error(`Currency is not enabled for company: ${input.currency}`);
        }
        if (!Array.isArray(input.lines) || input.lines.length === 0) {
            throw new Error('Sales order must contain at least one line');
        }
        const lines = [];
        for (let i = 0; i < input.lines.length; i += 1) {
            lines.push(await this.buildLine(input.companyId, input.lines[i], i, input.exchangeRate));
        }
        const now = new Date();
        const orderNumber = await (0, exports.generateUniqueDocumentNumber)(settings, 'SO', async (candidate) => !!(await this.salesOrderRepo.getByNumber(input.companyId, candidate)));
        const so = new SalesOrder_1.SalesOrder({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            orderNumber,
            customerId: customer.id,
            customerName: customer.displayName,
            orderDate: input.orderDate,
            expectedDeliveryDate: input.expectedDeliveryDate,
            currency: input.currency,
            exchangeRate: input.exchangeRate,
            lines,
            subtotalBase: 0,
            taxTotalBase: 0,
            grandTotalBase: 0,
            subtotalDoc: 0,
            taxTotalDoc: 0,
            grandTotalDoc: 0,
            status: 'DRAFT',
            notes: input.notes,
            internalNotes: input.internalNotes,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.salesOrderRepo.create(so);
        await this.settingsRepo.saveSettings(settings);
        return so;
    }
    assertCustomer(customer, customerId) {
        if (!customer)
            throw new Error(`Customer not found: ${customerId}`);
        if (!customer.roles.includes('CUSTOMER')) {
            throw new Error(`Party is not a customer: ${customerId}`);
        }
    }
    async buildLine(companyId, lineInput, index, exchangeRate) {
        var _a;
        const item = await this.itemRepo.getItem(lineInput.itemId);
        if (!item)
            throw new Error(`Item not found: ${lineInput.itemId}`);
        let taxCodeId = lineInput.taxCodeId;
        let taxRate = 0;
        if (!taxCodeId && item.defaultSalesTaxCodeId) {
            const defaultTaxCode = await this.taxCodeRepo.getById(companyId, item.defaultSalesTaxCodeId);
            if (defaultTaxCode && defaultTaxCode.active && (defaultTaxCode.scope === 'SALES' || defaultTaxCode.scope === 'BOTH')) {
                taxCodeId = defaultTaxCode.id;
                taxRate = defaultTaxCode.rate;
            }
        }
        else if (taxCodeId) {
            const selectedTaxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
            if (!selectedTaxCode)
                throw new Error(`Tax code not found: ${taxCodeId}`);
            assertValidSalesTaxCode(selectedTaxCode, taxCodeId);
            taxRate = selectedTaxCode.rate;
        }
        const lineTotalDoc = roundMoney(lineInput.orderedQty * lineInput.unitPriceDoc);
        const unitPriceBase = roundMoney(lineInput.unitPriceDoc * exchangeRate);
        const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);
        const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
        const taxAmountBase = roundMoney(lineTotalBase * taxRate);
        return {
            lineId: lineInput.lineId || (0, crypto_1.randomUUID)(),
            lineNo: (_a = lineInput.lineNo) !== null && _a !== void 0 ? _a : index + 1,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            itemType: item.type,
            trackInventory: item.trackInventory,
            orderedQty: lineInput.orderedQty,
            uomId: lineInput.uomId || item.salesUomId || item.baseUomId,
            uom: lineInput.uom || item.salesUom || item.baseUom,
            deliveredQty: 0,
            invoicedQty: 0,
            returnedQty: 0,
            unitPriceDoc: lineInput.unitPriceDoc,
            lineTotalDoc,
            unitPriceBase,
            lineTotalBase,
            taxCodeId,
            taxRate,
            taxAmountDoc,
            taxAmountBase,
            warehouseId: lineInput.warehouseId,
            description: lineInput.description,
        };
    }
}
exports.CreateSalesOrderUseCase = CreateSalesOrderUseCase;
class UpdateSalesOrderUseCase {
    constructor(salesOrderRepo, partyRepo, itemRepo, taxCodeRepo) {
        this.salesOrderRepo = salesOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
        this.taxCodeRepo = taxCodeRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f;
        const current = await this.salesOrderRepo.getById(input.companyId, input.id);
        if (!current)
            throw new Error(`Sales order not found: ${input.id}`);
        if (current.status !== 'DRAFT') {
            throw new Error('Only draft sales orders can be updated');
        }
        const customer = await this.partyRepo.getById(input.companyId, input.customerId || current.customerId);
        if (!customer)
            throw new Error(`Customer not found: ${input.customerId || current.customerId}`);
        if (!customer.roles.includes('CUSTOMER')) {
            throw new Error(`Party is not a customer: ${customer.id}`);
        }
        const exchangeRate = (_a = input.exchangeRate) !== null && _a !== void 0 ? _a : current.exchangeRate;
        const rawLines = input.lines
            ? input.lines
            : current.lines.map((line) => ({
                lineId: line.lineId,
                lineNo: line.lineNo,
                itemId: line.itemId,
                orderedQty: line.orderedQty,
                uomId: line.uomId,
                uom: line.uom,
                unitPriceDoc: line.unitPriceDoc,
                taxCodeId: line.taxCodeId,
                warehouseId: line.warehouseId,
                description: line.description,
            }));
        const currentLineById = new Map(current.lines.map((line) => [line.lineId, line]));
        const lines = [];
        for (let i = 0; i < rawLines.length; i += 1) {
            lines.push(await this.buildLine(input.companyId, rawLines[i], i, exchangeRate, currentLineById.get(rawLines[i].lineId || '')));
        }
        const updated = new SalesOrder_1.SalesOrder({
            id: current.id,
            companyId: current.companyId,
            orderNumber: current.orderNumber,
            customerId: customer.id,
            customerName: customer.displayName,
            orderDate: (_b = input.orderDate) !== null && _b !== void 0 ? _b : current.orderDate,
            expectedDeliveryDate: (_c = input.expectedDeliveryDate) !== null && _c !== void 0 ? _c : current.expectedDeliveryDate,
            currency: (_d = input.currency) !== null && _d !== void 0 ? _d : current.currency,
            exchangeRate,
            lines,
            subtotalBase: 0,
            taxTotalBase: 0,
            grandTotalBase: 0,
            subtotalDoc: 0,
            taxTotalDoc: 0,
            grandTotalDoc: 0,
            status: current.status,
            notes: (_e = input.notes) !== null && _e !== void 0 ? _e : current.notes,
            internalNotes: (_f = input.internalNotes) !== null && _f !== void 0 ? _f : current.internalNotes,
            createdBy: current.createdBy,
            createdAt: current.createdAt,
            updatedAt: new Date(),
            confirmedAt: current.confirmedAt,
            closedAt: current.closedAt,
        });
        await this.salesOrderRepo.update(updated);
        return updated;
    }
    async buildLine(companyId, lineInput, index, exchangeRate, currentLine) {
        var _a, _b, _c, _d, _e;
        const item = await this.itemRepo.getItem(lineInput.itemId);
        if (!item)
            throw new Error(`Item not found: ${lineInput.itemId}`);
        let taxRate = 0;
        if (lineInput.taxCodeId) {
            const taxCode = await this.taxCodeRepo.getById(companyId, lineInput.taxCodeId);
            if (!taxCode)
                throw new Error(`Tax code not found: ${lineInput.taxCodeId}`);
            assertValidSalesTaxCode(taxCode, lineInput.taxCodeId);
            taxRate = taxCode.rate;
        }
        const lineTotalDoc = roundMoney(lineInput.orderedQty * lineInput.unitPriceDoc);
        const unitPriceBase = roundMoney(lineInput.unitPriceDoc * exchangeRate);
        const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);
        const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
        const taxAmountBase = roundMoney(lineTotalBase * taxRate);
        return {
            lineId: lineInput.lineId || (currentLine === null || currentLine === void 0 ? void 0 : currentLine.lineId) || (0, crypto_1.randomUUID)(),
            lineNo: (_b = (_a = lineInput.lineNo) !== null && _a !== void 0 ? _a : currentLine === null || currentLine === void 0 ? void 0 : currentLine.lineNo) !== null && _b !== void 0 ? _b : index + 1,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            itemType: item.type,
            trackInventory: item.trackInventory,
            orderedQty: lineInput.orderedQty,
            uomId: lineInput.uomId || (currentLine === null || currentLine === void 0 ? void 0 : currentLine.uomId) || item.salesUomId || item.baseUomId,
            uom: lineInput.uom || item.salesUom || item.baseUom,
            deliveredQty: (_c = currentLine === null || currentLine === void 0 ? void 0 : currentLine.deliveredQty) !== null && _c !== void 0 ? _c : 0,
            invoicedQty: (_d = currentLine === null || currentLine === void 0 ? void 0 : currentLine.invoicedQty) !== null && _d !== void 0 ? _d : 0,
            returnedQty: (_e = currentLine === null || currentLine === void 0 ? void 0 : currentLine.returnedQty) !== null && _e !== void 0 ? _e : 0,
            unitPriceDoc: lineInput.unitPriceDoc,
            lineTotalDoc,
            unitPriceBase,
            lineTotalBase,
            taxCodeId: lineInput.taxCodeId,
            taxRate,
            taxAmountDoc,
            taxAmountBase,
            warehouseId: lineInput.warehouseId,
            description: lineInput.description,
        };
    }
}
exports.UpdateSalesOrderUseCase = UpdateSalesOrderUseCase;
class ConfirmSalesOrderUseCase {
    constructor(salesOrderRepo) {
        this.salesOrderRepo = salesOrderRepo;
    }
    async execute(companyId, id) {
        const so = await this.salesOrderRepo.getById(companyId, id);
        if (!so)
            throw new Error(`Sales order not found: ${id}`);
        if (so.status !== 'DRAFT')
            throw new Error('Only draft sales orders can be confirmed');
        if (!so.lines.length)
            throw new Error('Sales order must contain at least one line');
        so.status = 'CONFIRMED';
        so.confirmedAt = new Date();
        so.updatedAt = new Date();
        await this.salesOrderRepo.update(so);
        return so;
    }
}
exports.ConfirmSalesOrderUseCase = ConfirmSalesOrderUseCase;
class CancelSalesOrderUseCase {
    constructor(salesOrderRepo) {
        this.salesOrderRepo = salesOrderRepo;
    }
    async execute(companyId, id) {
        const so = await this.salesOrderRepo.getById(companyId, id);
        if (!so)
            throw new Error(`Sales order not found: ${id}`);
        if (!['DRAFT', 'CONFIRMED'].includes(so.status)) {
            throw new Error('Only draft or confirmed sales orders can be cancelled');
        }
        const hasLinkedActivity = so.lines.some((line) => line.deliveredQty > 0 || line.invoicedQty > 0);
        if (hasLinkedActivity) {
            throw new Error('Cannot cancel sales order with delivered or invoiced quantities');
        }
        so.status = 'CANCELLED';
        so.updatedAt = new Date();
        await this.salesOrderRepo.update(so);
        return so;
    }
}
exports.CancelSalesOrderUseCase = CancelSalesOrderUseCase;
class CloseSalesOrderUseCase {
    constructor(salesOrderRepo) {
        this.salesOrderRepo = salesOrderRepo;
    }
    async execute(companyId, id) {
        const so = await this.salesOrderRepo.getById(companyId, id);
        if (!so)
            throw new Error(`Sales order not found: ${id}`);
        if (!['CONFIRMED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED'].includes(so.status)) {
            throw new Error('Only confirmed or delivered sales orders can be closed');
        }
        so.status = 'CLOSED';
        so.closedAt = new Date();
        so.updatedAt = new Date();
        await this.salesOrderRepo.update(so);
        return so;
    }
}
exports.CloseSalesOrderUseCase = CloseSalesOrderUseCase;
class GetSalesOrderUseCase {
    constructor(salesOrderRepo) {
        this.salesOrderRepo = salesOrderRepo;
    }
    async execute(companyId, id) {
        const so = await this.salesOrderRepo.getById(companyId, id);
        if (!so)
            throw new Error(`Sales order not found: ${id}`);
        return so;
    }
}
exports.GetSalesOrderUseCase = GetSalesOrderUseCase;
class ListSalesOrdersUseCase {
    constructor(salesOrderRepo) {
        this.salesOrderRepo = salesOrderRepo;
    }
    async execute(companyId, filters = {}) {
        const usesDateFilter = Boolean(filters.dateFrom || filters.dateTo);
        const orders = await this.salesOrderRepo.list(companyId, {
            status: filters.status,
            customerId: filters.customerId,
            limit: usesDateFilter ? undefined : filters.limit,
            offset: usesDateFilter ? undefined : filters.offset,
        });
        if (!usesDateFilter)
            return orders;
        const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const to = filters.dateTo ? new Date(filters.dateTo) : null;
        const filtered = orders.filter((order) => {
            const date = new Date(order.orderDate);
            if (from && date < from)
                return false;
            if (to && date > to)
                return false;
            return true;
        });
        const offset = Math.max(0, filters.offset || 0);
        const sliced = filtered.slice(offset);
        if (!filters.limit || filters.limit < 0)
            return sliced;
        return sliced.slice(0, filters.limit);
    }
}
exports.ListSalesOrdersUseCase = ListSalesOrdersUseCase;
//# sourceMappingURL=SalesOrderUseCases.js.map