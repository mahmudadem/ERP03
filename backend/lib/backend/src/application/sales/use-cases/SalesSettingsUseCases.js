"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesSettingsUseCase = exports.GetSalesSettingsUseCase = exports.InitializeSalesUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const SalesSettings_1 = require("../../../domain/sales/entities/SalesSettings");
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
        module: template.module || 'SALES',
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
        baseType: template.baseType || template.code,
        createdAt: now,
        updatedAt: now,
        createdBy,
    };
};
const ensureSalesVoucherDefinitions = async (companyId, createdBy, voucherTypeRepo, voucherFormRepo) => {
    // Fetch ALL system templates from the unified source of truth
    const systemTemplates = await voucherTypeRepo.getSystemTemplates();
    const salesTemplates = systemTemplates.filter(t => t.module === 'SALES');
    if (salesTemplates.length === 0) {
        console.warn('[SalesSettingsUseCases] No SALES system templates found. Check seeder!');
    }
    for (const template of salesTemplates) {
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
                console.log(`Re-homing Sales Form ${form.name} from ${form.module} to ${template.module}`);
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
class InitializeSalesUseCase {
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
        const workflowMode = DocumentPolicyResolver_1.DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode);
        if (this.inventorySettingsRepo) {
            const inventorySettings = await this.inventorySettingsRepo.getSettings(input.companyId);
            const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(inventorySettings);
            DocumentPolicyResolver_1.DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
        }
        const workflowDefaults = DocumentPolicyResolver_1.DocumentPolicyResolver.applySalesWorkflowDefaults(workflowMode, {
            allowDirectInvoicing: (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requireSOForStockItems: (_b = input.requireSOForStockItems) !== null && _b !== void 0 ? _b : false,
        });
        const settings = new SalesSettings_1.SalesSettings({
            companyId: input.companyId,
            workflowMode,
            allowDirectInvoicing: workflowDefaults.allowDirectInvoicing,
            requireSOForStockItems: workflowDefaults.requireSOForStockItems,
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
    constructor(settingsRepo, accountRepo, voucherTypeRepo, voucherFormRepo, inventorySettingsRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Sales settings are not initialized');
        }
        const workflowMode = DocumentPolicyResolver_1.DocumentPolicyResolver.normalizeWorkflowMode((_a = input.workflowMode) !== null && _a !== void 0 ? _a : existing.workflowMode);
        if (this.inventorySettingsRepo) {
            const inventorySettings = await this.inventorySettingsRepo.getSettings(input.companyId);
            const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(inventorySettings);
            DocumentPolicyResolver_1.DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
        }
        const workflowDefaults = DocumentPolicyResolver_1.DocumentPolicyResolver.applySalesWorkflowDefaults(workflowMode, {
            allowDirectInvoicing: (_b = input.allowDirectInvoicing) !== null && _b !== void 0 ? _b : existing.allowDirectInvoicing,
            requireSOForStockItems: (_c = input.requireSOForStockItems) !== null && _c !== void 0 ? _c : existing.requireSOForStockItems,
        });
        const nextAllowDirectInvoicing = workflowDefaults.allowDirectInvoicing;
        const nextARAccountId = (_d = input.defaultARAccountId) !== null && _d !== void 0 ? _d : existing.defaultARAccountId;
        const nextRevenueAccountId = (_e = input.defaultRevenueAccountId) !== null && _e !== void 0 ? _e : existing.defaultRevenueAccountId;
        const nextDefaultInventoryAccountId = (_f = input.defaultInventoryAccountId) !== null && _f !== void 0 ? _f : existing.defaultInventoryAccountId;
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
            workflowMode,
            allowDirectInvoicing: nextAllowDirectInvoicing,
            requireSOForStockItems: workflowDefaults.requireSOForStockItems,
            defaultARAccountId: nextARAccountId,
            defaultRevenueAccountId: nextRevenueAccountId,
            defaultCOGSAccountId: (_g = input.defaultCOGSAccountId) !== null && _g !== void 0 ? _g : existing.defaultCOGSAccountId,
            defaultInventoryAccountId: nextDefaultInventoryAccountId,
            defaultSalesExpenseAccountId: (_h = input.defaultSalesExpenseAccountId) !== null && _h !== void 0 ? _h : existing.defaultSalesExpenseAccountId,
            allowOverDelivery: (_j = input.allowOverDelivery) !== null && _j !== void 0 ? _j : existing.allowOverDelivery,
            overDeliveryTolerancePct: (_k = input.overDeliveryTolerancePct) !== null && _k !== void 0 ? _k : existing.overDeliveryTolerancePct,
            overInvoiceTolerancePct: (_l = input.overInvoiceTolerancePct) !== null && _l !== void 0 ? _l : existing.overInvoiceTolerancePct,
            defaultPaymentTermsDays: (_m = input.defaultPaymentTermsDays) !== null && _m !== void 0 ? _m : existing.defaultPaymentTermsDays,
            salesVoucherTypeId: (_o = input.salesVoucherTypeId) !== null && _o !== void 0 ? _o : existing.salesVoucherTypeId,
            defaultWarehouseId: (_p = input.defaultWarehouseId) !== null && _p !== void 0 ? _p : existing.defaultWarehouseId,
            soNumberPrefix: (_q = input.soNumberPrefix) !== null && _q !== void 0 ? _q : existing.soNumberPrefix,
            soNumberNextSeq: (_r = input.soNumberNextSeq) !== null && _r !== void 0 ? _r : existing.soNumberNextSeq,
            dnNumberPrefix: (_s = input.dnNumberPrefix) !== null && _s !== void 0 ? _s : existing.dnNumberPrefix,
            dnNumberNextSeq: (_t = input.dnNumberNextSeq) !== null && _t !== void 0 ? _t : existing.dnNumberNextSeq,
            siNumberPrefix: (_u = input.siNumberPrefix) !== null && _u !== void 0 ? _u : existing.siNumberPrefix,
            siNumberNextSeq: (_v = input.siNumberNextSeq) !== null && _v !== void 0 ? _v : existing.siNumberNextSeq,
            srNumberPrefix: (_w = input.srNumberPrefix) !== null && _w !== void 0 ? _w : existing.srNumberPrefix,
            srNumberNextSeq: (_x = input.srNumberNextSeq) !== null && _x !== void 0 ? _x : existing.srNumberNextSeq,
        });
        await this.settingsRepo.saveSettings(updated);
        return updated;
    }
}
exports.UpdateSalesSettingsUseCase = UpdateSalesSettingsUseCase;
//# sourceMappingURL=SalesSettingsUseCases.js.map