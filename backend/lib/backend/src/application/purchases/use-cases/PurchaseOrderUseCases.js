"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPurchaseOrdersUseCase = exports.GetPurchaseOrderUseCase = exports.ClosePurchaseOrderUseCase = exports.CancelPurchaseOrderUseCase = exports.ConfirmPurchaseOrderUseCase = exports.UpdatePurchaseOrderUseCase = exports.CreatePurchaseOrderUseCase = exports.generateDocumentNumber = void 0;
const crypto_1 = require("crypto");
const PurchaseOrder_1 = require("../../../domain/purchases/entities/PurchaseOrder");
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const generateDocumentNumber = (settings, docType) => {
    let prefix = '';
    let seq = 1;
    if (docType === 'PO') {
        prefix = settings.poNumberPrefix;
        seq = settings.poNumberNextSeq;
        settings.poNumberNextSeq += 1;
    }
    else if (docType === 'GRN') {
        prefix = settings.grnNumberPrefix;
        seq = settings.grnNumberNextSeq;
        settings.grnNumberNextSeq += 1;
    }
    else if (docType === 'PI') {
        prefix = settings.piNumberPrefix;
        seq = settings.piNumberNextSeq;
        settings.piNumberNextSeq += 1;
    }
    else {
        prefix = settings.prNumberPrefix;
        seq = settings.prNumberNextSeq;
        settings.prNumberNextSeq += 1;
    }
    const padded = String(seq).padStart(5, '0');
    return `${prefix}-${padded}`;
};
exports.generateDocumentNumber = generateDocumentNumber;
class CreatePurchaseOrderUseCase {
    constructor(settingsRepo, purchaseOrderRepo, partyRepo, itemRepo, taxCodeRepo, companyCurrencyRepo) {
        this.settingsRepo = settingsRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(input) {
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings) {
            throw new Error('Purchases module is not initialized');
        }
        const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
        this.assertVendor(vendor, input.vendorId);
        const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.currency);
        if (!currencyEnabled) {
            throw new Error(`Currency is not enabled for company: ${input.currency}`);
        }
        if (!Array.isArray(input.lines) || input.lines.length === 0) {
            throw new Error('Purchase order must contain at least one line');
        }
        const lines = [];
        for (let i = 0; i < input.lines.length; i++) {
            const line = await this.buildLine(input.companyId, input.lines[i], i, input.exchangeRate);
            lines.push(line);
        }
        const orderNumber = await this.reserveUniqueOrderNumber(input.companyId, settings);
        const now = new Date();
        const po = new PurchaseOrder_1.PurchaseOrder({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            orderNumber,
            vendorId: vendor.id,
            vendorName: vendor.displayName,
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
        await this.purchaseOrderRepo.create(po);
        await this.settingsRepo.saveSettings(settings);
        return po;
    }
    async reserveUniqueOrderNumber(companyId, settings) {
        const MAX_ATTEMPTS = 100;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            const candidate = (0, exports.generateDocumentNumber)(settings, 'PO');
            const existing = await this.purchaseOrderRepo.getByNumber(companyId, candidate);
            if (!existing)
                return candidate;
        }
        throw new Error('Failed to generate a unique purchase order number. Please retry.');
    }
    assertVendor(vendor, vendorId) {
        if (!vendor) {
            throw new Error(`Vendor not found: ${vendorId}`);
        }
        if (!vendor.roles.includes('VENDOR')) {
            throw new Error(`Party is not a vendor: ${vendorId}`);
        }
    }
    async buildLine(companyId, lineInput, index, exchangeRate) {
        var _a;
        const item = await this.itemRepo.getItem(lineInput.itemId);
        if (!item) {
            throw new Error(`Item not found: ${lineInput.itemId}`);
        }
        let taxCodeId = lineInput.taxCodeId;
        let taxRate = 0;
        if (!taxCodeId && item.defaultPurchaseTaxCodeId) {
            const defaultTaxCode = await this.taxCodeRepo.getById(companyId, item.defaultPurchaseTaxCodeId);
            if (defaultTaxCode && defaultTaxCode.active && (defaultTaxCode.scope === 'PURCHASE' || defaultTaxCode.scope === 'BOTH')) {
                taxCodeId = defaultTaxCode.id;
                taxRate = defaultTaxCode.rate;
            }
        }
        else if (taxCodeId) {
            const selectedTaxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
            if (!selectedTaxCode) {
                throw new Error(`Tax code not found: ${taxCodeId}`);
            }
            if (!selectedTaxCode.active || (selectedTaxCode.scope !== 'PURCHASE' && selectedTaxCode.scope !== 'BOTH')) {
                throw new Error(`Tax code is not valid for purchase: ${taxCodeId}`);
            }
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
            uomId: lineInput.uomId || item.purchaseUomId || item.baseUomId,
            uom: lineInput.uom || item.purchaseUom || item.baseUom,
            receivedQty: 0,
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
exports.CreatePurchaseOrderUseCase = CreatePurchaseOrderUseCase;
class UpdatePurchaseOrderUseCase {
    constructor(purchaseOrderRepo, partyRepo, itemRepo, taxCodeRepo) {
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
        this.taxCodeRepo = taxCodeRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f;
        const current = await this.purchaseOrderRepo.getById(input.companyId, input.id);
        if (!current) {
            throw new Error(`Purchase order not found: ${input.id}`);
        }
        if (current.status !== 'DRAFT') {
            throw new Error('Only draft purchase orders can be updated');
        }
        let vendor = await this.partyRepo.getById(input.companyId, input.vendorId || current.vendorId);
        if (!vendor) {
            throw new Error(`Vendor not found: ${input.vendorId || current.vendorId}`);
        }
        if (!vendor.roles.includes('VENDOR')) {
            throw new Error(`Party is not a vendor: ${vendor.id}`);
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
        for (let i = 0; i < rawLines.length; i++) {
            const raw = rawLines[i];
            const currentLine = raw.lineId ? currentLineById.get(raw.lineId) : undefined;
            const line = await this.buildLine(input.companyId, raw, i, exchangeRate, currentLine);
            lines.push(line);
        }
        const updated = new PurchaseOrder_1.PurchaseOrder({
            id: current.id,
            companyId: current.companyId,
            orderNumber: current.orderNumber,
            vendorId: vendor.id,
            vendorName: vendor.displayName,
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
        await this.purchaseOrderRepo.update(updated);
        return updated;
    }
    async buildLine(companyId, lineInput, index, exchangeRate, currentLine) {
        var _a, _b, _c, _d, _e;
        const item = await this.itemRepo.getItem(lineInput.itemId);
        if (!item) {
            throw new Error(`Item not found: ${lineInput.itemId}`);
        }
        let taxRate = 0;
        if (lineInput.taxCodeId) {
            const taxCode = await this.taxCodeRepo.getById(companyId, lineInput.taxCodeId);
            if (!taxCode) {
                throw new Error(`Tax code not found: ${lineInput.taxCodeId}`);
            }
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
            uomId: lineInput.uomId || (currentLine === null || currentLine === void 0 ? void 0 : currentLine.uomId) || item.purchaseUomId || item.baseUomId,
            uom: lineInput.uom || item.purchaseUom || item.baseUom,
            receivedQty: (_c = currentLine === null || currentLine === void 0 ? void 0 : currentLine.receivedQty) !== null && _c !== void 0 ? _c : 0,
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
exports.UpdatePurchaseOrderUseCase = UpdatePurchaseOrderUseCase;
class ConfirmPurchaseOrderUseCase {
    constructor(purchaseOrderRepo) {
        this.purchaseOrderRepo = purchaseOrderRepo;
    }
    async execute(companyId, id) {
        const po = await this.purchaseOrderRepo.getById(companyId, id);
        if (!po)
            throw new Error(`Purchase order not found: ${id}`);
        if (po.status !== 'DRAFT')
            throw new Error('Only draft purchase orders can be confirmed');
        if (!po.lines.length)
            throw new Error('Purchase order must contain at least one line');
        po.status = 'CONFIRMED';
        po.confirmedAt = new Date();
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po);
        return po;
    }
}
exports.ConfirmPurchaseOrderUseCase = ConfirmPurchaseOrderUseCase;
class CancelPurchaseOrderUseCase {
    constructor(purchaseOrderRepo) {
        this.purchaseOrderRepo = purchaseOrderRepo;
    }
    async execute(companyId, id) {
        const po = await this.purchaseOrderRepo.getById(companyId, id);
        if (!po)
            throw new Error(`Purchase order not found: ${id}`);
        if (!['DRAFT', 'CONFIRMED'].includes(po.status)) {
            throw new Error('Only draft or confirmed purchase orders can be cancelled');
        }
        const hasLinkedActivity = po.lines.some((line) => line.receivedQty > 0 || line.invoicedQty > 0);
        if (hasLinkedActivity) {
            throw new Error('Cannot cancel purchase order with received or invoiced quantities');
        }
        po.status = 'CANCELLED';
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po);
        return po;
    }
}
exports.CancelPurchaseOrderUseCase = CancelPurchaseOrderUseCase;
class ClosePurchaseOrderUseCase {
    constructor(purchaseOrderRepo) {
        this.purchaseOrderRepo = purchaseOrderRepo;
    }
    async execute(companyId, id) {
        const po = await this.purchaseOrderRepo.getById(companyId, id);
        if (!po)
            throw new Error(`Purchase order not found: ${id}`);
        if (!['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status)) {
            throw new Error('Only confirmed or received purchase orders can be closed');
        }
        po.status = 'CLOSED';
        po.closedAt = new Date();
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po);
        return po;
    }
}
exports.ClosePurchaseOrderUseCase = ClosePurchaseOrderUseCase;
class GetPurchaseOrderUseCase {
    constructor(purchaseOrderRepo) {
        this.purchaseOrderRepo = purchaseOrderRepo;
    }
    async execute(companyId, id) {
        const po = await this.purchaseOrderRepo.getById(companyId, id);
        if (!po)
            throw new Error(`Purchase order not found: ${id}`);
        return po;
    }
}
exports.GetPurchaseOrderUseCase = GetPurchaseOrderUseCase;
class ListPurchaseOrdersUseCase {
    constructor(purchaseOrderRepo) {
        this.purchaseOrderRepo = purchaseOrderRepo;
    }
    async execute(companyId, filters = {}) {
        const usesDateFilter = Boolean(filters.dateFrom || filters.dateTo);
        const orders = await this.purchaseOrderRepo.list(companyId, {
            status: filters.status,
            vendorId: filters.vendorId,
            limit: usesDateFilter ? undefined : filters.limit,
            offset: usesDateFilter ? undefined : filters.offset,
        });
        if (!usesDateFilter) {
            return orders;
        }
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
exports.ListPurchaseOrdersUseCase = ListPurchaseOrdersUseCase;
//# sourceMappingURL=PurchaseOrderUseCases.js.map