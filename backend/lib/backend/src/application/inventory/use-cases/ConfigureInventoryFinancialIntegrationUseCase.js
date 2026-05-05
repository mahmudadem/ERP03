"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigureInventoryFinancialIntegrationUseCase = void 0;
const InventorySettings_1 = require("../../../domain/inventory/entities/InventorySettings");
class ConfigureInventoryFinancialIntegrationUseCase {
    constructor(settingsRepo, companyModuleRepo, accountRepo, stockMovementRepo) {
        this.settingsRepo = settingsRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.accountRepo = accountRepo;
        this.stockMovementRepo = stockMovementRepo;
    }
    async execute(input) {
        const accountingModule = await this.companyModuleRepo.get(input.companyId, 'accounting');
        if (!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized)) {
            throw new Error('Accounting module must be initialized before configuring financial integration');
        }
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings) {
            throw new Error('Inventory module must be initialized before configuring financial integration');
        }
        if (settings.accountingMode && settings.accountingMode !== input.accountingMode) {
            const hasMovements = await this.stockMovementRepo.hasAnyMovements(input.companyId);
            if (hasMovements) {
                throw new Error('Cannot change inventory accounting mode after stock movements have been recorded. A migration or cutover is required.');
            }
        }
        if (input.accountingMethod === 'PERPETUAL') {
            if (!input.defaultInventoryAssetAccountId) {
                throw new Error('Default Inventory Asset Account is required for perpetual mode');
            }
            if (!input.defaultCOGSAccountId) {
                throw new Error('Default COGS Account is required for perpetual mode');
            }
            const invAssetAccount = await this.accountRepo.getById(input.companyId, input.defaultInventoryAssetAccountId);
            if (!invAssetAccount || invAssetAccount.status !== 'ACTIVE' || invAssetAccount.accountRole !== 'POSTING') {
                throw new Error('Invalid Inventory Asset Account');
            }
            const cogsAccount = await this.accountRepo.getById(input.companyId, input.defaultCOGSAccountId);
            if (!cogsAccount || cogsAccount.status !== 'ACTIVE' || cogsAccount.accountRole !== 'POSTING') {
                throw new Error('Invalid COGS Account');
            }
        }
        const updatedSettings = new InventorySettings_1.InventorySettings({
            companyId: settings.companyId,
            accountingMode: input.accountingMode,
            inventoryAccountingMethod: input.accountingMethod,
            defaultCostingMethod: settings.defaultCostingMethod,
            defaultCostCurrency: settings.defaultCostCurrency,
            defaultInventoryAssetAccountId: input.defaultInventoryAssetAccountId,
            allowNegativeStock: settings.allowNegativeStock,
            defaultWarehouseId: settings.defaultWarehouseId,
            autoGenerateItemCode: settings.autoGenerateItemCode,
            itemCodePrefix: settings.itemCodePrefix,
            itemCodeNextSeq: settings.itemCodeNextSeq,
            defaultCOGSAccountId: input.defaultCOGSAccountId,
        });
        await this.settingsRepo.saveSettings(updatedSettings);
    }
    async getHistoricalSummary(companyId) {
        var _a;
        const hasHistoricalData = await this.stockMovementRepo.hasAnyMovements(companyId);
        let earliestDate = null;
        let movementCount = 0;
        if (hasHistoricalData) {
            // For now we don't have a count method, but we can return 1+ if data exists
            movementCount = 1;
        }
        if (hasHistoricalData) {
            const allMovements = await this.stockMovementRepo.getMovementsByDateRange(companyId, '2000-01-01', new Date().toISOString().split('T')[0], { limit: 1 });
            earliestDate = ((_a = allMovements[0]) === null || _a === void 0 ? void 0 : _a.date) || null;
        }
        return { hasHistoricalData, movementCount, earliestDate };
    }
}
exports.ConfigureInventoryFinancialIntegrationUseCase = ConfigureInventoryFinancialIntegrationUseCase;
//# sourceMappingURL=ConfigureInventoryFinancialIntegrationUseCase.js.map