"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializeInventoryUseCase = void 0;
const crypto_1 = require("crypto");
const InventorySettings_1 = require("../../../domain/inventory/entities/InventorySettings");
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
class InitializeInventoryUseCase {
    constructor(companyRepo, settingsRepo, warehouseRepo, companyModuleRepo) {
        this.companyRepo = companyRepo;
        this.settingsRepo = settingsRepo;
        this.warehouseRepo = warehouseRepo;
        this.companyModuleRepo = companyModuleRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const company = await this.companyRepo.findById(input.companyId);
        if (!company) {
            throw new Error(`Company not found: ${input.companyId}`);
        }
        const currentSettings = await this.settingsRepo.getSettings(input.companyId);
        const warehouses = await this.warehouseRepo.getCompanyWarehouses(input.companyId, { limit: 1 });
        let defaultWarehouse = warehouses[0] || null;
        if (!defaultWarehouse) {
            const now = new Date();
            defaultWarehouse = new Warehouse_1.Warehouse({
                id: (0, crypto_1.randomUUID)(),
                companyId: input.companyId,
                name: input.defaultWarehouseName || 'Main Warehouse',
                code: input.defaultWarehouseCode || 'MAIN',
                active: true,
                isDefault: true,
                createdAt: now,
                updatedAt: now,
            });
            await this.warehouseRepo.createWarehouse(defaultWarehouse);
        }
        const settings = new InventorySettings_1.InventorySettings({
            companyId: input.companyId,
            inventoryAccountingMethod: input.inventoryAccountingMethod || (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.inventoryAccountingMethod) || 'PERPETUAL',
            defaultCostingMethod: 'MOVING_AVG',
            defaultCostCurrency: input.defaultCostCurrency || (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.defaultCostCurrency) || company.baseCurrency,
            defaultInventoryAssetAccountId: (_b = (_a = input.defaultInventoryAssetAccountId) !== null && _a !== void 0 ? _a : currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.defaultInventoryAssetAccountId) !== null && _b !== void 0 ? _b : undefined,
            allowNegativeStock: (_d = (_c = input.allowNegativeStock) !== null && _c !== void 0 ? _c : currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.allowNegativeStock) !== null && _d !== void 0 ? _d : true,
            defaultWarehouseId: (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.defaultWarehouseId) || defaultWarehouse.id,
            autoGenerateItemCode: (_f = (_e = input.autoGenerateItemCode) !== null && _e !== void 0 ? _e : currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.autoGenerateItemCode) !== null && _f !== void 0 ? _f : false,
            itemCodePrefix: (_g = input.itemCodePrefix) !== null && _g !== void 0 ? _g : currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.itemCodePrefix,
            itemCodeNextSeq: (_j = (_h = input.itemCodeNextSeq) !== null && _h !== void 0 ? _h : currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.itemCodeNextSeq) !== null && _j !== void 0 ? _j : 1,
            defaultCOGSAccountId: (_k = input.defaultCOGSAccountId) !== null && _k !== void 0 ? _k : currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.defaultCOGSAccountId,
        });
        await this.settingsRepo.saveSettings(settings);
        const now = new Date();
        const inventoryModule = await this.companyModuleRepo.get(input.companyId, 'inventory');
        if (inventoryModule) {
            await this.companyModuleRepo.update(input.companyId, 'inventory', {
                initialized: true,
                initializationStatus: 'complete',
                updatedAt: now,
            });
        }
        else {
            await this.companyModuleRepo.create({
                companyId: input.companyId,
                moduleCode: 'inventory',
                installedAt: now,
                initialized: true,
                initializationStatus: 'complete',
                config: {},
                updatedAt: now,
            });
        }
        return { settings, defaultWarehouse };
    }
}
exports.InitializeInventoryUseCase = InitializeInventoryUseCase;
//# sourceMappingURL=InitializeInventoryUseCase.js.map