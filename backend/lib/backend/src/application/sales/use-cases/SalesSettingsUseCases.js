"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesSettingsUseCase = exports.GetSalesSettingsUseCase = exports.InitializeSalesUseCase = void 0;
const SalesSettings_1 = require("../../../domain/sales/entities/SalesSettings");
class InitializeSalesUseCase {
    constructor(settingsRepo, accountRepo, companyModuleRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
        this.companyModuleRepo = companyModuleRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const [arAccount, revenueAccount] = await Promise.all([
            this.accountRepo.getById(input.companyId, input.defaultARAccountId),
            this.accountRepo.getById(input.companyId, input.defaultRevenueAccountId),
        ]);
        if (!arAccount) {
            throw new Error(`Default AR account not found: ${input.defaultARAccountId}`);
        }
        if (!revenueAccount) {
            throw new Error(`Default revenue account not found: ${input.defaultRevenueAccountId}`);
        }
        const settings = new SalesSettings_1.SalesSettings({
            companyId: input.companyId,
            salesControlMode: input.salesControlMode,
            requireSOForStockItems: (_a = input.requireSOForStockItems) !== null && _a !== void 0 ? _a : false,
            defaultARAccountId: input.defaultARAccountId,
            defaultRevenueAccountId: input.defaultRevenueAccountId,
            defaultCOGSAccountId: input.defaultCOGSAccountId,
            defaultSalesExpenseAccountId: input.defaultSalesExpenseAccountId,
            allowOverDelivery: (_b = input.allowOverDelivery) !== null && _b !== void 0 ? _b : false,
            overDeliveryTolerancePct: (_c = input.overDeliveryTolerancePct) !== null && _c !== void 0 ? _c : 0,
            overInvoiceTolerancePct: (_d = input.overInvoiceTolerancePct) !== null && _d !== void 0 ? _d : 0,
            defaultPaymentTermsDays: (_e = input.defaultPaymentTermsDays) !== null && _e !== void 0 ? _e : 30,
            salesVoucherTypeId: input.salesVoucherTypeId,
            defaultWarehouseId: input.defaultWarehouseId,
            soNumberPrefix: input.soNumberPrefix || 'SO',
            soNumberNextSeq: (_f = input.soNumberNextSeq) !== null && _f !== void 0 ? _f : 1,
            dnNumberPrefix: input.dnNumberPrefix || 'DN',
            dnNumberNextSeq: (_g = input.dnNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            siNumberPrefix: input.siNumberPrefix || 'SI',
            siNumberNextSeq: (_h = input.siNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            srNumberPrefix: input.srNumberPrefix || 'SR',
            srNumberNextSeq: (_j = input.srNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
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
    constructor(settingsRepo) {
        this.settingsRepo = settingsRepo;
    }
    async execute(companyId) {
        return this.settingsRepo.getSettings(companyId);
    }
}
exports.GetSalesSettingsUseCase = GetSalesSettingsUseCase;
class UpdateSalesSettingsUseCase {
    constructor(settingsRepo, accountRepo) {
        this.settingsRepo = settingsRepo;
        this.accountRepo = accountRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        const existing = await this.settingsRepo.getSettings(input.companyId);
        if (!existing) {
            throw new Error('Sales settings are not initialized');
        }
        const nextMode = (_a = input.salesControlMode) !== null && _a !== void 0 ? _a : existing.salesControlMode;
        const nextARAccountId = (_b = input.defaultARAccountId) !== null && _b !== void 0 ? _b : existing.defaultARAccountId;
        const nextRevenueAccountId = (_c = input.defaultRevenueAccountId) !== null && _c !== void 0 ? _c : existing.defaultRevenueAccountId;
        if (!nextARAccountId)
            throw new Error('defaultARAccountId is required');
        if (!nextRevenueAccountId)
            throw new Error('defaultRevenueAccountId is required');
        const [arAccount, revenueAccount] = await Promise.all([
            this.accountRepo.getById(input.companyId, nextARAccountId),
            this.accountRepo.getById(input.companyId, nextRevenueAccountId),
        ]);
        if (!arAccount)
            throw new Error(`Default AR account not found: ${nextARAccountId}`);
        if (!revenueAccount)
            throw new Error(`Default revenue account not found: ${nextRevenueAccountId}`);
        const updated = new SalesSettings_1.SalesSettings({
            companyId: existing.companyId,
            salesControlMode: nextMode,
            requireSOForStockItems: nextMode === 'CONTROLLED'
                ? true
                : ((_d = input.requireSOForStockItems) !== null && _d !== void 0 ? _d : existing.requireSOForStockItems),
            defaultARAccountId: nextARAccountId,
            defaultRevenueAccountId: nextRevenueAccountId,
            defaultCOGSAccountId: (_e = input.defaultCOGSAccountId) !== null && _e !== void 0 ? _e : existing.defaultCOGSAccountId,
            defaultSalesExpenseAccountId: (_f = input.defaultSalesExpenseAccountId) !== null && _f !== void 0 ? _f : existing.defaultSalesExpenseAccountId,
            allowOverDelivery: (_g = input.allowOverDelivery) !== null && _g !== void 0 ? _g : existing.allowOverDelivery,
            overDeliveryTolerancePct: (_h = input.overDeliveryTolerancePct) !== null && _h !== void 0 ? _h : existing.overDeliveryTolerancePct,
            overInvoiceTolerancePct: (_j = input.overInvoiceTolerancePct) !== null && _j !== void 0 ? _j : existing.overInvoiceTolerancePct,
            defaultPaymentTermsDays: (_k = input.defaultPaymentTermsDays) !== null && _k !== void 0 ? _k : existing.defaultPaymentTermsDays,
            salesVoucherTypeId: (_l = input.salesVoucherTypeId) !== null && _l !== void 0 ? _l : existing.salesVoucherTypeId,
            defaultWarehouseId: (_m = input.defaultWarehouseId) !== null && _m !== void 0 ? _m : existing.defaultWarehouseId,
            soNumberPrefix: (_o = input.soNumberPrefix) !== null && _o !== void 0 ? _o : existing.soNumberPrefix,
            soNumberNextSeq: (_p = input.soNumberNextSeq) !== null && _p !== void 0 ? _p : existing.soNumberNextSeq,
            dnNumberPrefix: (_q = input.dnNumberPrefix) !== null && _q !== void 0 ? _q : existing.dnNumberPrefix,
            dnNumberNextSeq: (_r = input.dnNumberNextSeq) !== null && _r !== void 0 ? _r : existing.dnNumberNextSeq,
            siNumberPrefix: (_s = input.siNumberPrefix) !== null && _s !== void 0 ? _s : existing.siNumberPrefix,
            siNumberNextSeq: (_t = input.siNumberNextSeq) !== null && _t !== void 0 ? _t : existing.siNumberNextSeq,
            srNumberPrefix: (_u = input.srNumberPrefix) !== null && _u !== void 0 ? _u : existing.srNumberPrefix,
            srNumberNextSeq: (_v = input.srNumberNextSeq) !== null && _v !== void 0 ? _v : existing.srNumberNextSeq,
        });
        await this.settingsRepo.saveSettings(updated);
        return updated;
    }
}
exports.UpdateSalesSettingsUseCase = UpdateSalesSettingsUseCase;
//# sourceMappingURL=SalesSettingsUseCases.js.map