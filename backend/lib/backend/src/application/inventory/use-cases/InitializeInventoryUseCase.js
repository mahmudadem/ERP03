"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializeInventoryUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const InventorySettings_1 = require("../../../domain/inventory/entities/InventorySettings");
const Uom_1 = require("../../../domain/inventory/entities/Uom");
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
class InitializeInventoryUseCase {
    constructor(companyRepo, settingsRepo, warehouseRepo, uomRepo, companyModuleRepo) {
        this.companyRepo = companyRepo;
        this.settingsRepo = settingsRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomRepo = uomRepo;
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
            accountingMode: input.accountingMode
                || (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.accountingMode)
                || DocumentPolicyResolver_1.DocumentPolicyResolver.legacyInventoryMethodToAccountingMode(input.inventoryAccountingMethod || (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.inventoryAccountingMethod) || 'PERPETUAL'),
            inventoryAccountingMethod: input.inventoryAccountingMethod
                || (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.inventoryAccountingMethod)
                || DocumentPolicyResolver_1.DocumentPolicyResolver.accountingModeToLegacyInventoryMethod(input.accountingMode || (currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.accountingMode) || 'PERPETUAL'),
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
        await this.ensureDefaultUoms(input.companyId, input.userId);
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
    async ensureDefaultUoms(companyId, userId) {
        const existing = await this.uomRepo.getCompanyUoms(companyId, { limit: 1 });
        if (existing.length > 0)
            return;
        const now = new Date();
        const defaults = [
            { code: 'EA', name: 'Each', dimension: 'COUNT', decimalPlaces: 0, isSystem: true },
            { code: 'PCS', name: 'Pieces', dimension: 'COUNT', decimalPlaces: 0, isSystem: true },
            { code: 'BOX', name: 'Box', dimension: 'COUNT', decimalPlaces: 0 },
            { code: 'PACK', name: 'Pack', dimension: 'COUNT', decimalPlaces: 0 },
            { code: 'KG', name: 'Kilogram', dimension: 'WEIGHT', decimalPlaces: 3, isSystem: true },
            { code: 'G', name: 'Gram', dimension: 'WEIGHT', decimalPlaces: 0, isSystem: true },
            { code: 'L', name: 'Litre', dimension: 'VOLUME', decimalPlaces: 3, isSystem: true },
            { code: 'ML', name: 'Millilitre', dimension: 'VOLUME', decimalPlaces: 0, isSystem: true },
            { code: 'M', name: 'Meter', dimension: 'LENGTH', decimalPlaces: 3, isSystem: true },
            { code: 'CM', name: 'Centimeter', dimension: 'LENGTH', decimalPlaces: 2, isSystem: true },
        ];
        await Promise.all(defaults.map((entry) => {
            var _a;
            return this.uomRepo.createUom(new Uom_1.Uom({
                id: (0, crypto_1.randomUUID)(),
                companyId,
                code: entry.code,
                name: entry.name,
                dimension: entry.dimension,
                decimalPlaces: entry.decimalPlaces,
                active: true,
                isSystem: (_a = entry.isSystem) !== null && _a !== void 0 ? _a : false,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
            }));
        }));
    }
}
exports.InitializeInventoryUseCase = InitializeInventoryUseCase;
//# sourceMappingURL=InitializeInventoryUseCase.js.map