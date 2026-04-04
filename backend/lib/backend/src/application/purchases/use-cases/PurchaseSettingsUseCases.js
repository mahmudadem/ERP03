"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePurchaseSettingsUseCase = exports.GetPurchaseSettingsUseCase = exports.InitializePurchasesUseCase = void 0;
const PurchaseSettings_1 = require("../../../domain/purchases/entities/PurchaseSettings");
class InitializePurchasesUseCase {
    constructor(settingsRepo, accountRepo, companyModuleRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.companyModuleRepo = companyModuleRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
        if (!apAccount) {
            throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
        }
        const settings = new PurchaseSettings_1.PurchaseSettings({
            companyId: input.companyId,
            procurementControlMode: input.procurementControlMode,
            requirePOForStockItems: (_a = input.requirePOForStockItems) !== null && _a !== void 0 ? _a : false,
            defaultAPAccountId: input.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId,
            allowOverDelivery: (_b = input.allowOverDelivery) !== null && _b !== void 0 ? _b : false,
            overDeliveryTolerancePct: (_c = input.overDeliveryTolerancePct) !== null && _c !== void 0 ? _c : 0,
            overInvoiceTolerancePct: (_d = input.overInvoiceTolerancePct) !== null && _d !== void 0 ? _d : 0,
            defaultPaymentTermsDays: (_e = input.defaultPaymentTermsDays) !== null && _e !== void 0 ? _e : 30,
            purchaseVoucherTypeId: input.purchaseVoucherTypeId,
            defaultWarehouseId: input.defaultWarehouseId,
            poNumberPrefix: input.poNumberPrefix || 'PO',
            poNumberNextSeq: (_f = input.poNumberNextSeq) !== null && _f !== void 0 ? _f : 1,
            grnNumberPrefix: input.grnNumberPrefix || 'GRN',
            grnNumberNextSeq: (_g = input.grnNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            piNumberPrefix: input.piNumberPrefix || 'PI',
            piNumberNextSeq: (_h = input.piNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            prNumberPrefix: input.prNumberPrefix || 'PR',
            prNumberNextSeq: (_j = input.prNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
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
    constructor(settingsRepo) {
        this.settingsRepo = settingsRepo;
    }
    async execute(companyId) {
        return this.settingsRepo.getSettings(companyId);
    }
}
exports.GetPurchaseSettingsUseCase = GetPurchaseSettingsUseCase;
class UpdatePurchaseSettingsUseCase {
    constructor(settingsRepo, accountRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Purchase settings are not initialized');
        }
        const nextMode = (_a = input.procurementControlMode) !== null && _a !== void 0 ? _a : existing.procurementControlMode;
        const nextAPAccountId = (_b = input.defaultAPAccountId) !== null && _b !== void 0 ? _b : existing.defaultAPAccountId;
        if (!nextAPAccountId) {
            throw new Error('defaultAPAccountId is required');
        }
        const apAccount = await this.accountRepo.getById(input.companyId, nextAPAccountId);
        if (!apAccount) {
            throw new Error(`Default AP account not found: ${nextAPAccountId}`);
        }
        const updated = new PurchaseSettings_1.PurchaseSettings({
            companyId: existing.companyId,
            procurementControlMode: nextMode,
            requirePOForStockItems: nextMode === 'CONTROLLED'
                ? true
                : ((_c = input.requirePOForStockItems) !== null && _c !== void 0 ? _c : existing.requirePOForStockItems),
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