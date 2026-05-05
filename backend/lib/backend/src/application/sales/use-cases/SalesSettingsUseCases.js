"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesSettingsUseCase = exports.GetSalesSettingsUseCase = exports.InitializeSalesUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const SalesSettings_1 = require("../../../domain/sales/entities/SalesSettings");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const AppError_1 = require("../../../errors/AppError");
const ErrorCodes_1 = require("../../../errors/ErrorCodes");
// Note: Hardcoded templates are now deprecated and will be removed in a future PR
// Source of truth is now system_metadata/voucher_types/items seeded by seedSystemVoucherTypes.ts
const cloneTemplateValue = (val) => (val ? JSON.parse(JSON.stringify(val)) : null);
const normalizeModule = (value) => String(value || '').trim().toUpperCase();
const ensureVoucherTypeScope = async (voucherTypeRepo, companyId, voucherTypeId, expectedModule, fieldName) => {
    if (!voucherTypeId)
        return;
    const voucherType = await voucherTypeRepo.getVoucherType(companyId, voucherTypeId);
    if (!voucherType) {
        throw new Error(`${fieldName} not found: ${voucherTypeId}`);
    }
    if (normalizeModule(voucherType.module) !== expectedModule) {
        throw new Error(`${fieldName} must belong to ${expectedModule} module`);
    }
};
const cloneVoucherTypeForCompany = (companyId, template) => {
    var _a;
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), companyId, template.name, template.code, template.module, cloneTemplateValue(template.headerFields), cloneTemplateValue(template.tableColumns), cloneTemplateValue(template.layout), template.schemaVersion || 2, template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined, cloneTemplateValue(template.workflow), cloneTemplateValue(template.uiModeOverrides), (_a = template.isMultiLine) !== null && _a !== void 0 ? _a : true, cloneTemplateValue(template.rules) || [], cloneTemplateValue(template.actions) || [], template.defaultCurrency, template.voucherType, template.persona);
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
        formType: template.formType || template.baseType || template.code,
        voucherType: template.voucherType || template.code,
        persona: template.persona || undefined,
        baseType: template.baseType || template.code,
        createdAt: now,
        updatedAt: now,
        createdBy,
    };
};
const ensureSalesVoucherDefinitions = async (companyId, createdBy, voucherTypeRepo, voucherFormRepo) => {
    const systemTemplates = await voucherTypeRepo.getSystemTemplates();
    const salesTemplates = systemTemplates.filter(t => t.module === 'SALES');
    if (salesTemplates.length === 0) {
        console.warn('[SalesSettingsUseCases] No SALES system templates found. Check seeder!');
    }
    for (const template of salesTemplates) {
        const existingType = await voucherTypeRepo.getByCode(companyId, template.code);
        if (existingType)
            continue; // Already exists, skip
        const companyVoucherType = cloneVoucherTypeForCompany(companyId, template);
        companyVoucherType.module = template.module;
        await voucherTypeRepo.createVoucherType(companyVoucherType);
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
        const workflowDefaults = DocumentPolicyResolver_1.DocumentPolicyResolver.applySalesWorkflowDefaults(workflowMode, {
            allowDirectInvoicing: (_a = input.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requireSOForStockItems: (_b = input.requireSOForStockItems) !== null && _b !== void 0 ? _b : false,
        });
        const defaultSalesInvoicePersona = workflowMode === 'SIMPLE' ? 'direct' : 'linked';
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
            governanceRules: (_g = input.governanceRules) !== null && _g !== void 0 ? _g : [],
            defaultSalesInvoicePersona: (_h = input.defaultSalesInvoicePersona) !== null && _h !== void 0 ? _h : defaultSalesInvoicePersona,
            defaultWarehouseId: input.defaultWarehouseId,
            soNumberPrefix: input.soNumberPrefix || 'SO',
            soNumberNextSeq: (_j = input.soNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
            dnNumberPrefix: input.dnNumberPrefix || 'DN',
            dnNumberNextSeq: (_k = input.dnNumberNextSeq) !== null && _k !== void 0 ? _k : 1,
            siNumberPrefix: input.siNumberPrefix || 'SI',
            siNumberNextSeq: (_l = input.siNumberNextSeq) !== null && _l !== void 0 ? _l : 1,
            srNumberPrefix: input.srNumberPrefix || 'SR',
            srNumberNextSeq: (_m = input.srNumberNextSeq) !== null && _m !== void 0 ? _m : 1,
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
                isEnabled: true,
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
        return settings;
    }
}
exports.GetSalesSettingsUseCase = GetSalesSettingsUseCase;
class UpdateSalesSettingsUseCase {
    constructor(settingsRepo, accountRepo, voucherTypeRepo, voucherFormRepo, salesOrderRepo, deliveryNoteRepo, inventorySettingsRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Sales settings are not initialized');
        }
        const oldWorkflowMode = existing.workflowMode || 'OPERATIONAL';
        const newWorkflowMode = DocumentPolicyResolver_1.DocumentPolicyResolver.normalizeWorkflowMode((_a = input.workflowMode) !== null && _a !== void 0 ? _a : existing.workflowMode);
        // Guard: SIMPLE mode blocks if there are open commitments
        if (input.workflowMode === 'SIMPLE' && existing.workflowMode !== 'SIMPLE') {
            const hasOpenSO = await this.salesOrderRepo.hasOpenOrders(input.companyId);
            if (hasOpenSO) {
                throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.SALES_TRANSITION_BLOCKED, 'Cannot switch to Simple workflow while there are open Sales Orders. Please close or cancel all open orders first.');
            }
            const hasUnpostedDN = await this.deliveryNoteRepo.hasUnpostedDeliveryNotes(input.companyId);
            if (hasUnpostedDN) {
                throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.SALES_TRANSITION_BLOCKED, 'Cannot switch to Simple workflow while there are draft or posted delivery notes. Please process or delete them first.');
            }
        }
        const workflowDefaults = DocumentPolicyResolver_1.DocumentPolicyResolver.applySalesWorkflowDefaults(newWorkflowMode, {
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
        const updated = new SalesSettings_1.SalesSettings({
            companyId: existing.companyId,
            workflowMode: newWorkflowMode,
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
            governanceRules: (_o = input.governanceRules) !== null && _o !== void 0 ? _o : existing.governanceRules,
            defaultSalesInvoicePersona: (_p = input.defaultSalesInvoicePersona) !== null && _p !== void 0 ? _p : existing.defaultSalesInvoicePersona,
            defaultWarehouseId: (_q = input.defaultWarehouseId) !== null && _q !== void 0 ? _q : existing.defaultWarehouseId,
            soNumberPrefix: (_r = input.soNumberPrefix) !== null && _r !== void 0 ? _r : existing.soNumberPrefix,
            soNumberNextSeq: (_s = input.soNumberNextSeq) !== null && _s !== void 0 ? _s : existing.soNumberNextSeq,
            dnNumberPrefix: (_t = input.dnNumberPrefix) !== null && _t !== void 0 ? _t : existing.dnNumberPrefix,
            dnNumberNextSeq: (_u = input.dnNumberNextSeq) !== null && _u !== void 0 ? _u : existing.dnNumberNextSeq,
            siNumberPrefix: (_v = input.siNumberPrefix) !== null && _v !== void 0 ? _v : existing.siNumberPrefix,
            siNumberNextSeq: (_w = input.siNumberNextSeq) !== null && _w !== void 0 ? _w : existing.siNumberNextSeq,
            srNumberPrefix: (_x = input.srNumberPrefix) !== null && _x !== void 0 ? _x : existing.srNumberPrefix,
            srNumberNextSeq: (_y = input.srNumberNextSeq) !== null && _y !== void 0 ? _y : existing.srNumberNextSeq,
        });
        await this.settingsRepo.saveSettings(updated);
        return updated;
    }
}
exports.UpdateSalesSettingsUseCase = UpdateSalesSettingsUseCase;
//# sourceMappingURL=SalesSettingsUseCases.js.map