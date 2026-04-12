"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePurchaseSettingsUseCase = exports.GetPurchaseSettingsUseCase = exports.InitializePurchasesUseCase = void 0;
const crypto_1 = require("crypto");
const PurchaseSettings_1 = require("../../../domain/purchases/entities/PurchaseSettings");
const PostingRole_1 = require("../../../domain/designer/entities/PostingRole");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const PURCHASE_VOUCHER_SEED_TEMPLATES = {
    purchase_order: {
        name: 'Purchase Order',
        code: 'purchase_order',
        module: 'PURCHASE',
        prefix: 'PO',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
            { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, isPosting: false, postingRole: null },
            { id: 'notes', label: 'Internal Notes', type: 'TEXT', isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', width: '250px' },
            { fieldId: 'quantity', width: '100px' },
            { fieldId: 'unitPrice', width: '120px' },
            { fieldId: 'lineTotal', width: '120px' },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'supplierId', 'currency', 'exchangeRate'] },
                { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
            ],
        },
    },
    grn: {
        name: 'Goods Receipt Note',
        code: 'grn',
        module: 'PURCHASE',
        prefix: 'GRN',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'receiptDate', label: 'Receipt Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
            { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'warehouseId', label: 'Warehouse', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'purchaseOrderId', label: 'PO Reference', type: 'SELECT', required: false, isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', width: '250px' },
            { fieldId: 'quantity', width: '100px' },
            { fieldId: 'uom', width: '80px' },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Receipt Info', fieldIds: ['receiptDate', 'supplierId', 'warehouseId', 'purchaseOrderId'] },
                { id: 'lines', title: 'Received Items', fieldIds: ['lineItems'] },
            ],
        },
    },
    purchase_invoice: {
        name: 'Purchase Invoice',
        code: 'purchase_invoice',
        module: 'PURCHASE',
        prefix: 'PI',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
            { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, isPosting: true, postingRole: PostingRole_1.PostingRole.AMOUNT },
            { id: 'description', label: 'Description', type: 'TEXT', isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', width: '220px' },
            { fieldId: 'quantity', width: '100px' },
            { fieldId: 'unitPrice', width: '100px' },
            { fieldId: 'lineTotal', width: '120px' },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Purchase Invoice Header', fieldIds: ['date', 'supplierId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
                { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
            ],
        },
    },
    purchase_return: {
        name: 'Purchase Return',
        code: 'purchase_return',
        module: 'PURCHASE',
        prefix: 'PR',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
            { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, isPosting: true, postingRole: PostingRole_1.PostingRole.AMOUNT },
            { id: 'description', label: 'Description', type: 'TEXT', isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', width: '220px' },
            { fieldId: 'quantity', width: '100px' },
            { fieldId: 'unitPrice', width: '100px' },
            { fieldId: 'lineTotal', width: '120px' },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Purchase Return Header', fieldIds: ['date', 'supplierId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
                { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
            ],
        },
    },
};
const cloneTemplateValue = (value) => {
    if (value === undefined || value === null) {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
};
const buildFallbackVoucherType = (companyId, templateCode) => {
    const template = PURCHASE_VOUCHER_SEED_TEMPLATES[templateCode];
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), companyId, template.name, template.code, template.module, cloneTemplateValue(template.headerFields), cloneTemplateValue(template.tableColumns), cloneTemplateValue(template.layout), 2);
};
const buildFallbackVoucherForm = (companyId, typeId, createdBy, templateCode) => {
    const template = PURCHASE_VOUCHER_SEED_TEMPLATES[templateCode];
    const now = new Date();
    return {
        id: (0, crypto_1.randomUUID)(),
        companyId,
        module: template.module,
        typeId,
        name: template.name,
        code: template.code,
        description: `${template.name} system default form`,
        prefix: template.prefix,
        isDefault: true,
        isSystemGenerated: true,
        isLocked: false,
        enabled: true,
        headerFields: cloneTemplateValue(template.headerFields),
        tableColumns: cloneTemplateValue(template.tableColumns),
        layout: cloneTemplateValue(template.layout),
        uiModeOverrides: null,
        rules: [],
        actions: [],
        isMultiLine: true,
        tableStyle: 'web',
        baseType: template.code,
        createdAt: now,
        updatedAt: now,
        createdBy,
    };
};
const cloneVoucherTypeForCompany = (companyId, template) => {
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), companyId, template.name, template.code, template.module, cloneTemplateValue(template.headerFields), cloneTemplateValue(template.tableColumns), cloneTemplateValue(template.layout), template.schemaVersion, template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined, cloneTemplateValue(template.workflow), cloneTemplateValue(template.uiModeOverrides), template.isMultiLine, cloneTemplateValue(template.rules), cloneTemplateValue(template.actions), template.defaultCurrency);
};
const cloneVoucherFormForCompany = (companyId, typeId, createdBy, template) => {
    var _a, _b;
    const now = new Date();
    return {
        id: (0, crypto_1.randomUUID)(),
        companyId,
        module: template.module,
        typeId,
        name: template.name,
        code: template.code,
        description: template.description || '',
        prefix: template.prefix,
        numberFormat: template.numberFormat,
        isDefault: true,
        isSystemGenerated: true,
        isLocked: false,
        enabled: (_a = template.enabled) !== null && _a !== void 0 ? _a : true,
        headerFields: cloneTemplateValue(template.headerFields),
        tableColumns: cloneTemplateValue(template.tableColumns),
        layout: cloneTemplateValue(template.layout),
        uiModeOverrides: cloneTemplateValue(template.uiModeOverrides),
        rules: cloneTemplateValue(template.rules) || [],
        actions: cloneTemplateValue(template.actions) || [],
        isMultiLine: (_b = template.isMultiLine) !== null && _b !== void 0 ? _b : true,
        tableStyle: template.tableStyle || 'web',
        defaultCurrency: template.defaultCurrency,
        baseType: template.baseType || template.code,
        createdAt: now,
        updatedAt: now,
        createdBy,
    };
};
const ensurePurchaseVoucherDefinitions = async (companyId, createdBy, voucherTypeRepo, voucherFormRepo) => {
    const templates = Object.values(PURCHASE_VOUCHER_SEED_TEMPLATES);
    for (const template of templates) {
        const existingType = await voucherTypeRepo.getByCode(companyId, template.code);
        // If it exists but in the WRONG module, we need to re-home it
        if (existingType && existingType.module !== template.module && existingType.companyId === companyId) {
            console.log(`Re-homing ${template.code} from ${existingType.module} to ${template.module}`);
            await voucherTypeRepo.deleteVoucherType(companyId, existingType.id); // Delete the misplaced one
            // Proceed to create the new one below
        }
        const companyVoucherType = existingType && existingType.module === template.module && existingType.companyId === companyId
            ? existingType
            : cloneVoucherTypeForCompany(companyId, existingType || buildFallbackVoucherType(companyId, template.code));
        // Ensure the cloned one has the correct module
        companyVoucherType.module = template.module;
        await voucherTypeRepo.createVoucherType(companyVoucherType);
        // FORM MIGRATION / RE-HOMING
        // Check if forms exist ANYWHERE for this type
        const allExistingForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
        for (const form of allExistingForms) {
            if (form.module !== template.module) {
                console.log(`Re-homing Form ${form.name} from ${form.module} to ${template.module}`);
                // Delete old
                await voucherFormRepo.delete(companyId, form.id);
                // Create new with correct module
                await voucherFormRepo.create(Object.assign(Object.assign({}, form), { module: template.module }));
            }
        }
        const companyForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
        if (companyForms.length > 0)
            continue;
        const fallbackForm = await voucherFormRepo.getDefaultForType(companyId, template.code);
        const companyForm = fallbackForm
            ? cloneVoucherFormForCompany(companyId, companyVoucherType.id, createdBy, fallbackForm)
            : buildFallbackVoucherForm(companyId, companyVoucherType.id, createdBy, template.code);
        await voucherFormRepo.create(companyForm);
    }
};
class InitializePurchasesUseCase {
    constructor(settingsRepo, accountRepo, companyModuleRepo, voucherTypeRepo, voucherFormRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (input.defaultAPAccountId) {
            const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
            if (!apAccount) {
                throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
            }
        }
        await ensurePurchaseVoucherDefinitions(input.companyId, input.userId || 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        const settings = new PurchaseSettings_1.PurchaseSettings({
            companyId: input.companyId,
            allowDirectInvoicing: (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requirePOForStockItems: (_b = input.requirePOForStockItems) !== null && _b !== void 0 ? _b : false,
            defaultAPAccountId: input.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId,
            allowOverDelivery: (_c = input.allowOverDelivery) !== null && _c !== void 0 ? _c : false,
            overDeliveryTolerancePct: (_d = input.overDeliveryTolerancePct) !== null && _d !== void 0 ? _d : 0,
            overInvoiceTolerancePct: (_e = input.overInvoiceTolerancePct) !== null && _e !== void 0 ? _e : 0,
            defaultPaymentTermsDays: (_f = input.defaultPaymentTermsDays) !== null && _f !== void 0 ? _f : 30,
            purchaseVoucherTypeId: input.purchaseVoucherTypeId,
            defaultWarehouseId: input.defaultWarehouseId,
            poNumberPrefix: input.poNumberPrefix || 'PO',
            poNumberNextSeq: (_g = input.poNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            grnNumberPrefix: input.grnNumberPrefix || 'GRN',
            grnNumberNextSeq: (_h = input.grnNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            piNumberPrefix: input.piNumberPrefix || 'PI',
            piNumberNextSeq: (_j = input.piNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
            prNumberPrefix: input.prNumberPrefix || 'PR',
            prNumberNextSeq: (_k = input.prNumberNextSeq) !== null && _k !== void 0 ? _k : 1,
        });
        await this.settingsRepo.saveSettings(settings);
        const now = new Date();
        const purchaseModule = await this.companyModuleRepo.get(input.companyId, 'purchase');
        if (purchaseModule) {
            await this.companyModuleRepo.update(input.companyId, 'purchase', {
                initialized: true,
                initializationStatus: 'complete',
                updatedAt: now,
            });
        }
        else {
            await this.companyModuleRepo.create({
                companyId: input.companyId,
                moduleCode: 'purchase',
                installedAt: now,
                initialized: true,
                initializationStatus: 'complete',
                config: {},
                updatedAt: now,
            });
        }
        return settings;
    }
}
exports.InitializePurchasesUseCase = InitializePurchasesUseCase;
class GetPurchaseSettingsUseCase {
    constructor(settingsRepo, voucherTypeRepo, voucherFormRepo) {
        this.settingsRepo = settingsRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
    }
    async execute(companyId) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings) {
            return null;
        }
        await ensurePurchaseVoucherDefinitions(companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        return settings;
    }
}
exports.GetPurchaseSettingsUseCase = GetPurchaseSettingsUseCase;
class UpdatePurchaseSettingsUseCase {
    constructor(settingsRepo, accountRepo, voucherTypeRepo, voucherFormRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Purchase settings are not initialized');
        }
        const nextAllowDirectInvoicing = (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : existing.allowDirectInvoicing;
        const nextAPAccountId = (_b = input.defaultAPAccountId) !== null && _b !== void 0 ? _b : existing.defaultAPAccountId;
        if (nextAPAccountId) {
            const apAccount = await this.accountRepo.getById(input.companyId, nextAPAccountId);
            if (!apAccount) {
                throw new Error(`Default AP account not found: ${nextAPAccountId}`);
            }
        }
        await ensurePurchaseVoucherDefinitions(input.companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        const updated = new PurchaseSettings_1.PurchaseSettings({
            companyId: existing.companyId,
            allowDirectInvoicing: nextAllowDirectInvoicing,
            requirePOForStockItems: (_c = input.requirePOForStockItems) !== null && _c !== void 0 ? _c : existing.requirePOForStockItems,
            defaultAPAccountId: nextAPAccountId,
            defaultPurchaseExpenseAccountId: (_d = input.defaultPurchaseExpenseAccountId) !== null && _d !== void 0 ? _d : existing.defaultPurchaseExpenseAccountId,
            allowOverDelivery: (_e = input.allowOverDelivery) !== null && _e !== void 0 ? _e : existing.allowOverDelivery,
            overDeliveryTolerancePct: (_f = input.overDeliveryTolerancePct) !== null && _f !== void 0 ? _f : existing.overDeliveryTolerancePct,
            overInvoiceTolerancePct: (_g = input.overInvoiceTolerancePct) !== null && _g !== void 0 ? _g : existing.overInvoiceTolerancePct,
            defaultPaymentTermsDays: (_h = input.defaultPaymentTermsDays) !== null && _h !== void 0 ? _h : existing.defaultPaymentTermsDays,
            purchaseVoucherTypeId: (_j = input.purchaseVoucherTypeId) !== null && _j !== void 0 ? _j : existing.purchaseVoucherTypeId,
            defaultWarehouseId: (_k = input.defaultWarehouseId) !== null && _k !== void 0 ? _k : existing.defaultWarehouseId,
            poNumberPrefix: (_l = input.poNumberPrefix) !== null && _l !== void 0 ? _l : existing.poNumberPrefix,
            poNumberNextSeq: (_m = input.poNumberNextSeq) !== null && _m !== void 0 ? _m : existing.poNumberNextSeq,
            grnNumberPrefix: (_o = input.grnNumberPrefix) !== null && _o !== void 0 ? _o : existing.grnNumberPrefix,
            grnNumberNextSeq: (_p = input.grnNumberNextSeq) !== null && _p !== void 0 ? _p : existing.grnNumberNextSeq,
            piNumberPrefix: (_q = input.piNumberPrefix) !== null && _q !== void 0 ? _q : existing.piNumberPrefix,
            piNumberNextSeq: (_r = input.piNumberNextSeq) !== null && _r !== void 0 ? _r : existing.piNumberNextSeq,
            prNumberPrefix: (_s = input.prNumberPrefix) !== null && _s !== void 0 ? _s : existing.prNumberPrefix,
            prNumberNextSeq: (_t = input.prNumberNextSeq) !== null && _t !== void 0 ? _t : existing.prNumberNextSeq,
        });
        await this.settingsRepo.saveSettings(updated);
        return updated;
    }
}
exports.UpdatePurchaseSettingsUseCase = UpdatePurchaseSettingsUseCase;
//# sourceMappingURL=PurchaseSettingsUseCases.js.map