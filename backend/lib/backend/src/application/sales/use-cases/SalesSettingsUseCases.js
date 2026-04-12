"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesSettingsUseCase = exports.GetSalesSettingsUseCase = exports.InitializeSalesUseCase = void 0;
const crypto_1 = require("crypto");
const SalesSettings_1 = require("../../../domain/sales/entities/SalesSettings");
const PostingRole_1 = require("../../../domain/designer/entities/PostingRole");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const SALES_VOUCHER_SEED_TEMPLATES = {
    sales_order: {
        name: 'Sales Order',
        code: 'sales_order',
        module: 'SALES',
        prefix: 'SO',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
            { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
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
                { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'customerId', 'currency', 'exchangeRate'] },
                { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
            ],
        },
    },
    delivery_note: {
        name: 'Delivery Note',
        code: 'delivery_note',
        module: 'SALES',
        prefix: 'DN',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'deliveryDate', label: 'Delivery Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
            { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'warehouseId', label: 'Warehouse', type: 'SELECT', required: true, isPosting: false, postingRole: null },
            { id: 'salesOrderId', label: 'SO Reference', type: 'SELECT', required: false, isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', width: '250px' },
            { fieldId: 'quantity', width: '100px' },
            { fieldId: 'uom', width: '80px' },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Delivery Info', fieldIds: ['deliveryDate', 'customerId', 'warehouseId', 'salesOrderId'] },
                { id: 'lines', title: 'Delivered Items', fieldIds: ['lineItems'] },
            ],
        },
    },
    sales_invoice: {
        name: 'Sales Invoice',
        code: 'sales_invoice',
        module: 'SALES',
        prefix: 'SI',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
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
                { id: 'header', title: 'Sales Invoice Header', fieldIds: ['date', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
                { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
            ],
        },
    },
    sales_return: {
        name: 'Sales Return',
        code: 'sales_return',
        module: 'SALES',
        prefix: 'SR',
        sidebarGroup: 'Documents',
        headerFields: [
            { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
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
                { id: 'header', title: 'Sales Return Header', fieldIds: ['date', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
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
    const template = SALES_VOUCHER_SEED_TEMPLATES[templateCode];
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), companyId, template.name, template.code, template.module, cloneTemplateValue(template.headerFields), cloneTemplateValue(template.tableColumns), cloneTemplateValue(template.layout), 2);
};
const buildFallbackVoucherForm = (companyId, typeId, createdBy, templateCode) => {
    const template = SALES_VOUCHER_SEED_TEMPLATES[templateCode];
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
const ensureSalesVoucherDefinitions = async (companyId, createdBy, voucherTypeRepo, voucherFormRepo) => {
    const templates = Object.values(SALES_VOUCHER_SEED_TEMPLATES);
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
        // Ensure correct module tagging
        companyVoucherType.module = template.module;
        await voucherTypeRepo.createVoucherType(companyVoucherType);
        // FORM MIGRATION / RE-HOMING - Run for EVERY template
        const allExistingForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
        for (const form of allExistingForms) {
            if (form.module !== template.module) {
                console.log(`Re-homing Sales Form ${form.name} from ${form.module} to ${template.module}`);
                await voucherFormRepo.delete(companyId, form.id);
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
class InitializeSalesUseCase {
    constructor(settingsRepo, accountRepo, companyModuleRepo, voucherTypeRepo, voucherFormRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const [revenueAccount, inventoryAccount, arAccount] = await Promise.all([
            this.accountRepo.getById(input.companyId, input.defaultRevenueAccountId),
            input.defaultInventoryAccountId
                ? this.accountRepo.getById(input.companyId, input.defaultInventoryAccountId)
                : Promise.resolve(null),
            input.defaultARAccountId
                ? this.accountRepo.getById(input.companyId, input.defaultARAccountId)
                : Promise.resolve(null),
        ]);
        if (!revenueAccount) {
            throw new Error(`Default revenue account not found: ${input.defaultRevenueAccountId}`);
        }
        if (input.defaultInventoryAccountId && !inventoryAccount) {
            throw new Error(`Default inventory account not found: ${input.defaultInventoryAccountId}`);
        }
        if (input.defaultARAccountId && !arAccount) {
            throw new Error(`Default AR account not found: ${input.defaultARAccountId}`);
        }
        await ensureSalesVoucherDefinitions(input.companyId, input.userId || 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        const settings = new SalesSettings_1.SalesSettings({
            companyId: input.companyId,
            allowDirectInvoicing: (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requireSOForStockItems: (_b = input.requireSOForStockItems) !== null && _b !== void 0 ? _b : false,
            defaultARAccountId: input.defaultARAccountId,
            defaultRevenueAccountId: input.defaultRevenueAccountId,
            defaultCOGSAccountId: input.defaultCOGSAccountId,
            defaultInventoryAccountId: input.defaultInventoryAccountId,
            defaultSalesExpenseAccountId: input.defaultSalesExpenseAccountId,
            allowOverDelivery: (_c = input.allowOverDelivery) !== null && _c !== void 0 ? _c : false,
            overDeliveryTolerancePct: (_d = input.overDeliveryTolerancePct) !== null && _d !== void 0 ? _d : 0,
            overInvoiceTolerancePct: (_e = input.overInvoiceTolerancePct) !== null && _e !== void 0 ? _e : 0,
            defaultPaymentTermsDays: (_f = input.defaultPaymentTermsDays) !== null && _f !== void 0 ? _f : 30,
            salesVoucherTypeId: input.salesVoucherTypeId,
            defaultWarehouseId: input.defaultWarehouseId,
            soNumberPrefix: input.soNumberPrefix || 'SO',
            soNumberNextSeq: (_g = input.soNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            dnNumberPrefix: input.dnNumberPrefix || 'DN',
            dnNumberNextSeq: (_h = input.dnNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            siNumberPrefix: input.siNumberPrefix || 'SI',
            siNumberNextSeq: (_j = input.siNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
            srNumberPrefix: input.srNumberPrefix || 'SR',
            srNumberNextSeq: (_k = input.srNumberNextSeq) !== null && _k !== void 0 ? _k : 1,
        });
        await this.settingsRepo.saveSettings(settings);
        const now = new Date();
        const salesModule = await this.companyModuleRepo.get(input.companyId, 'sales');
        if (salesModule) {
            await this.companyModuleRepo.update(input.companyId, 'sales', {
                initialized: true,
                initializationStatus: 'complete',
                updatedAt: now,
            });
        }
        else {
            await this.companyModuleRepo.create({
                companyId: input.companyId,
                moduleCode: 'sales',
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
exports.InitializeSalesUseCase = InitializeSalesUseCase;
class GetSalesSettingsUseCase {
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
        await ensureSalesVoucherDefinitions(companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        return settings;
    }
}
exports.GetSalesSettingsUseCase = GetSalesSettingsUseCase;
class UpdateSalesSettingsUseCase {
    constructor(settingsRepo, accountRepo, voucherTypeRepo, voucherFormRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Sales settings are not initialized');
        }
        const nextAllowDirectInvoicing = (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : existing.allowDirectInvoicing;
        const nextARAccountId = (_b = input.defaultARAccountId) !== null && _b !== void 0 ? _b : existing.defaultARAccountId;
        const nextRevenueAccountId = (_c = input.defaultRevenueAccountId) !== null && _c !== void 0 ? _c : existing.defaultRevenueAccountId;
        const nextDefaultInventoryAccountId = (_d = input.defaultInventoryAccountId) !== null && _d !== void 0 ? _d : existing.defaultInventoryAccountId;
        if (!nextRevenueAccountId)
            throw new Error('defaultRevenueAccountId is required');
        const [revenueAccount, inventoryAccount, arAccount] = await Promise.all([
            this.accountRepo.getById(input.companyId, nextRevenueAccountId),
            nextDefaultInventoryAccountId
                ? this.accountRepo.getById(input.companyId, nextDefaultInventoryAccountId)
                : Promise.resolve(null),
            nextARAccountId
                ? this.accountRepo.getById(input.companyId, nextARAccountId)
                : Promise.resolve(null),
        ]);
        if (!revenueAccount)
            throw new Error(`Default revenue account not found: ${nextRevenueAccountId}`);
        if (nextDefaultInventoryAccountId && !inventoryAccount) {
            throw new Error(`Default inventory account not found: ${nextDefaultInventoryAccountId}`);
        }
        if (nextARAccountId && !arAccount) {
            throw new Error(`Default AR account not found: ${nextARAccountId}`);
        }
        await ensureSalesVoucherDefinitions(input.companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        const updated = new SalesSettings_1.SalesSettings({
            companyId: existing.companyId,
            allowDirectInvoicing: nextAllowDirectInvoicing,
            requireSOForStockItems: (_e = input.requireSOForStockItems) !== null && _e !== void 0 ? _e : existing.requireSOForStockItems,
            defaultARAccountId: nextARAccountId,
            defaultRevenueAccountId: nextRevenueAccountId,
            defaultCOGSAccountId: (_f = input.defaultCOGSAccountId) !== null && _f !== void 0 ? _f : existing.defaultCOGSAccountId,
            defaultInventoryAccountId: nextDefaultInventoryAccountId,
            defaultSalesExpenseAccountId: (_g = input.defaultSalesExpenseAccountId) !== null && _g !== void 0 ? _g : existing.defaultSalesExpenseAccountId,
            allowOverDelivery: (_h = input.allowOverDelivery) !== null && _h !== void 0 ? _h : existing.allowOverDelivery,
            overDeliveryTolerancePct: (_j = input.overDeliveryTolerancePct) !== null && _j !== void 0 ? _j : existing.overDeliveryTolerancePct,
            overInvoiceTolerancePct: (_k = input.overInvoiceTolerancePct) !== null && _k !== void 0 ? _k : existing.overInvoiceTolerancePct,
            defaultPaymentTermsDays: (_l = input.defaultPaymentTermsDays) !== null && _l !== void 0 ? _l : existing.defaultPaymentTermsDays,
            salesVoucherTypeId: (_m = input.salesVoucherTypeId) !== null && _m !== void 0 ? _m : existing.salesVoucherTypeId,
            defaultWarehouseId: (_o = input.defaultWarehouseId) !== null && _o !== void 0 ? _o : existing.defaultWarehouseId,
            soNumberPrefix: (_p = input.soNumberPrefix) !== null && _p !== void 0 ? _p : existing.soNumberPrefix,
            soNumberNextSeq: (_q = input.soNumberNextSeq) !== null && _q !== void 0 ? _q : existing.soNumberNextSeq,
            dnNumberPrefix: (_r = input.dnNumberPrefix) !== null && _r !== void 0 ? _r : existing.dnNumberPrefix,
            dnNumberNextSeq: (_s = input.dnNumberNextSeq) !== null && _s !== void 0 ? _s : existing.dnNumberNextSeq,
            siNumberPrefix: (_t = input.siNumberPrefix) !== null && _t !== void 0 ? _t : existing.siNumberPrefix,
            siNumberNextSeq: (_u = input.siNumberNextSeq) !== null && _u !== void 0 ? _u : existing.siNumberNextSeq,
            srNumberPrefix: (_v = input.srNumberPrefix) !== null && _v !== void 0 ? _v : existing.srNumberPrefix,
            srNumberNextSeq: (_w = input.srNumberNextSeq) !== null && _w !== void 0 ? _w : existing.srNumberNextSeq,
        });
        await this.settingsRepo.saveSettings(updated);
        return updated;
    }
}
exports.UpdateSalesSettingsUseCase = UpdateSalesSettingsUseCase;
//# sourceMappingURL=SalesSettingsUseCases.js.map