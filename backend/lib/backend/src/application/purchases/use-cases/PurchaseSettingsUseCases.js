"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePurchaseSettingsUseCase = exports.GetPurchaseSettingsUseCase = exports.InitializePurchasesUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const PurchaseSettings_1 = require("../../../domain/purchases/entities/PurchaseSettings");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
// Note: Hardcoded templates are now deprecated and will be removed in a future PR
// Source of truth is now system_metadata/voucher_types/items seeded by seedSystemVoucherTypes.ts
const cloneTemplateValue = (val) => (val ? JSON.parse(JSON.stringify(val)) : null);
const cloneVoucherTypeForCompany = (companyId, template) => {
    var _a;
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), companyId, template.name, template.code, template.module, cloneTemplateValue(template.headerFields), cloneTemplateValue(template.tableColumns), cloneTemplateValue(template.layout), template.schemaVersion || 2, template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined, cloneTemplateValue(template.workflow), cloneTemplateValue(template.uiModeOverrides), (_a = template.isMultiLine) !== null && _a !== void 0 ? _a : true, cloneTemplateValue(template.rules) || [], cloneTemplateValue(template.actions) || [], template.defaultCurrency);
};
const cloneVoucherFormForCompany = (companyId, typeId, createdBy, template // Can be from system metadata too
) => {
    var _a, _b;
    const now = new Date();
    return {
        id: (0, crypto_1.randomUUID)(),
        companyId,
        module: template.module || 'PURCHASE',
        typeId,
        name: template.name,
        code: template.code,
        description: template.description || `Default form for ${template.name}`,
        prefix: template.prefix,
        numberFormat: template.numberFormat,
        isDefault: true,
        isSystemGenerated: true,
        isLocked: true,
        enabled: (_a = template.enabled) !== null && _a !== void 0 ? _a : true,
        headerFields: cloneTemplateValue(template.headerFields) || [],
        tableColumns: cloneTemplateValue(template.tableColumns) || [],
        layout: cloneTemplateValue(template.layout) || { sections: [] },
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
    // Fetch ALL system templates from the unified source of truth
    const systemTemplates = await voucherTypeRepo.getSystemTemplates();
    const purchaseTemplates = systemTemplates.filter(t => t.module === 'PURCHASE');
    if (purchaseTemplates.length === 0) {
        console.warn('[PurchaseSettingsUseCases] No PURCHASE system templates found. Check seeder!');
    }
    for (const template of purchaseTemplates) {
        const existingType = await voucherTypeRepo.getByCode(companyId, template.code);
        // If it exists but in the WRONG module, we need to re-home it
        if (existingType && existingType.module !== template.module && existingType.companyId === companyId) {
            console.log(`Re-homing ${template.code} from ${existingType.module} to ${template.module}`);
            await voucherTypeRepo.deleteVoucherType(companyId, existingType.id);
            // We'll create it below
        }
        const companyVoucherType = existingType && existingType.module === template.module && existingType.companyId === companyId
            ? existingType
            : cloneVoucherTypeForCompany(companyId, template);
        // Set metadata correctly
        companyVoucherType.module = template.module;
        await voucherTypeRepo.createVoucherType(companyVoucherType);
        // FORM MIGRATION / RE-HOMING
        const allExistingForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
        for (const form of allExistingForms) {
            if (form.module !== template.module) {
                console.log(`Re-homing Purchase Form ${form.name} from ${form.module} to ${template.module}`);
                await voucherFormRepo.delete(companyId, form.id);
                await voucherFormRepo.create(Object.assign(Object.assign({}, form), { module: template.module }));
            }
        }
        const companyForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
        if (companyForms.length > 0)
            continue;
        // Create default form from template
        const companyForm = cloneVoucherFormForCompany(companyId, companyVoucherType.id, createdBy, template);
        await voucherFormRepo.create(companyForm);
    }
};
class InitializePurchasesUseCase {
    constructor(settingsRepo, accountRepo, companyModuleRepo, voucherTypeRepo, voucherFormRepo, inventorySettingsRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (input.defaultAPAccountId) {
            const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
            if (!apAccount) {
                throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
            }
        }
        if (input.defaultGRNIAccountId) {
            const grniAccount = await this.accountRepo.getById(input.companyId, input.defaultGRNIAccountId);
            if (!grniAccount) {
                throw new Error(`Default GRNI account not found: ${input.defaultGRNIAccountId}`);
            }
        }
        await ensurePurchaseVoucherDefinitions(input.companyId, input.userId || 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        const workflowMode = DocumentPolicyResolver_1.DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode);
        const accountingMode = this.inventorySettingsRepo
            ? DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(await this.inventorySettingsRepo.getSettings(input.companyId))
            : 'INVOICE_DRIVEN';
        DocumentPolicyResolver_1.DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
        const workflowDefaults = DocumentPolicyResolver_1.DocumentPolicyResolver.applyPurchaseWorkflowDefaults(workflowMode, {
            allowDirectInvoicing: (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requirePOForStockItems: (_b = input.requirePOForStockItems) !== null && _b !== void 0 ? _b : false,
        });
        if (accountingMode === 'PERPETUAL' && !input.defaultGRNIAccountId) {
            throw new Error('Default GRNI account is required for perpetual purchasing workflows.');
        }
        const settings = new PurchaseSettings_1.PurchaseSettings({
            companyId: input.companyId,
            workflowMode,
            allowDirectInvoicing: workflowDefaults.allowDirectInvoicing,
            requirePOForStockItems: workflowDefaults.requirePOForStockItems,
            defaultAPAccountId: input.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId,
            defaultGRNIAccountId: input.defaultGRNIAccountId,
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
    constructor(settingsRepo, accountRepo, voucherTypeRepo, voucherFormRepo, inventorySettingsRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Purchase settings are not initialized');
        }
        const workflowMode = DocumentPolicyResolver_1.DocumentPolicyResolver.normalizeWorkflowMode((_a = input.workflowMode) !== null && _a !== void 0 ? _a : existing.workflowMode);
        const accountingMode = this.inventorySettingsRepo
            ? DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(await this.inventorySettingsRepo.getSettings(input.companyId))
            : 'INVOICE_DRIVEN';
        DocumentPolicyResolver_1.DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
        const workflowDefaults = DocumentPolicyResolver_1.DocumentPolicyResolver.applyPurchaseWorkflowDefaults(workflowMode, {
            allowDirectInvoicing: (_b = input.allowDirectInvoicing) !== null && _b !== void 0 ? _b : existing.allowDirectInvoicing,
            requirePOForStockItems: (_c = input.requirePOForStockItems) !== null && _c !== void 0 ? _c : existing.requirePOForStockItems,
        });
        const nextAllowDirectInvoicing = workflowDefaults.allowDirectInvoicing;
        const nextAPAccountId = (_d = input.defaultAPAccountId) !== null && _d !== void 0 ? _d : existing.defaultAPAccountId;
        const nextGRNIAccountId = (_e = input.defaultGRNIAccountId) !== null && _e !== void 0 ? _e : existing.defaultGRNIAccountId;
        if (accountingMode === 'PERPETUAL' && !nextGRNIAccountId) {
            throw new Error('Default GRNI account is required for perpetual purchasing workflows.');
        }
        if (nextAPAccountId) {
            const apAccount = await this.accountRepo.getById(input.companyId, nextAPAccountId);
            if (!apAccount) {
                throw new Error(`Default AP account not found: ${nextAPAccountId}`);
            }
        }
        if (nextGRNIAccountId) {
            const grniAccount = await this.accountRepo.getById(input.companyId, nextGRNIAccountId);
            if (!grniAccount) {
                throw new Error(`Default GRNI account not found: ${nextGRNIAccountId}`);
            }
        }
        await ensurePurchaseVoucherDefinitions(input.companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
        const updated = new PurchaseSettings_1.PurchaseSettings({
            companyId: existing.companyId,
            workflowMode,
            allowDirectInvoicing: nextAllowDirectInvoicing,
            requirePOForStockItems: workflowDefaults.requirePOForStockItems,
            defaultAPAccountId: nextAPAccountId,
            defaultPurchaseExpenseAccountId: (_f = input.defaultPurchaseExpenseAccountId) !== null && _f !== void 0 ? _f : existing.defaultPurchaseExpenseAccountId,
            defaultGRNIAccountId: nextGRNIAccountId,
            allowOverDelivery: (_g = input.allowOverDelivery) !== null && _g !== void 0 ? _g : existing.allowOverDelivery,
            overDeliveryTolerancePct: (_h = input.overDeliveryTolerancePct) !== null && _h !== void 0 ? _h : existing.overDeliveryTolerancePct,
            overInvoiceTolerancePct: (_j = input.overInvoiceTolerancePct) !== null && _j !== void 0 ? _j : existing.overInvoiceTolerancePct,
            defaultPaymentTermsDays: (_k = input.defaultPaymentTermsDays) !== null && _k !== void 0 ? _k : existing.defaultPaymentTermsDays,
            purchaseVoucherTypeId: (_l = input.purchaseVoucherTypeId) !== null && _l !== void 0 ? _l : existing.purchaseVoucherTypeId,
            defaultWarehouseId: (_m = input.defaultWarehouseId) !== null && _m !== void 0 ? _m : existing.defaultWarehouseId,
            poNumberPrefix: (_o = input.poNumberPrefix) !== null && _o !== void 0 ? _o : existing.poNumberPrefix,
            poNumberNextSeq: (_p = input.poNumberNextSeq) !== null && _p !== void 0 ? _p : existing.poNumberNextSeq,
            grnNumberPrefix: (_q = input.grnNumberPrefix) !== null && _q !== void 0 ? _q : existing.grnNumberPrefix,
            grnNumberNextSeq: (_r = input.grnNumberNextSeq) !== null && _r !== void 0 ? _r : existing.grnNumberNextSeq,
            piNumberPrefix: (_s = input.piNumberPrefix) !== null && _s !== void 0 ? _s : existing.piNumberPrefix,
            piNumberNextSeq: (_t = input.piNumberNextSeq) !== null && _t !== void 0 ? _t : existing.piNumberNextSeq,
            prNumberPrefix: (_u = input.prNumberPrefix) !== null && _u !== void 0 ? _u : existing.prNumberPrefix,
            prNumberNextSeq: (_v = input.prNumberNextSeq) !== null && _v !== void 0 ? _v : existing.prNumberNextSeq,
        });
        await this.settingsRepo.saveSettings(updated);
        return updated;
    }
}
exports.UpdatePurchaseSettingsUseCase = UpdatePurchaseSettingsUseCase;
//# sourceMappingURL=PurchaseSettingsUseCases.js.map