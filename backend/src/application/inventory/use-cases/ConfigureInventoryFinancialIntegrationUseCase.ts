import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';

export interface ConfigureInventoryFinancialIntegrationInput {
  companyId: string;
  accountingMethod: 'PERIODIC' | 'PERPETUAL';
  accountingMode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
  defaultInventoryAssetAccountId?: string;
  defaultCOGSAccountId?: string;
  accountingStartDate?: string;
}

export class ConfigureInventoryFinancialIntegrationUseCase {
  constructor(
    private readonly settingsRepo: IInventorySettingsRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly stockMovementRepo: IStockMovementRepository
  ) {}

  async execute(input: ConfigureInventoryFinancialIntegrationInput): Promise<void> {
    const accountingModule = await this.companyModuleRepo.get(input.companyId, 'accounting');
    if (!accountingModule?.initialized) {
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

    const updatedSettings = new InventorySettings({
      companyId: settings.companyId,
      accountingMode: input.accountingMode,
      inventoryAccountingMethod: input.accountingMethod,
      defaultCostingMethod: settings.defaultCostingMethod,
      costingBasis: settings.costingBasis,
      inventoryFxCostBasis: settings.inventoryFxCostBasis,
      defaultLinePriceSource: settings.defaultLinePriceSource,
      defaultCostCurrency: settings.defaultCostCurrency,
      defaultInventoryAssetAccountId: input.defaultInventoryAssetAccountId,
      allowNegativeStock: settings.allowNegativeStock,
      allowDeferredCost: settings.allowDeferredCost,
      defaultWarehouseId: settings.defaultWarehouseId,
      autoGenerateItemCode: settings.autoGenerateItemCode,
      itemCodePrefix: settings.itemCodePrefix,
      itemCodeNextSeq: settings.itemCodeNextSeq,
      defaultCOGSAccountId: input.defaultCOGSAccountId,
      defaultInventoryGainAccountId: settings.defaultInventoryGainAccountId,
      defaultInventoryLossAccountId: settings.defaultInventoryLossAccountId,
      defaultInventoryTransferClearingAccountId: settings.defaultInventoryTransferClearingAccountId,
      defaultInventoryRevaluationAccountId: settings.defaultInventoryRevaluationAccountId,
      defaultOpeningBalanceAccountId: settings.defaultOpeningBalanceAccountId,
      allowNegativeInventoryValue: settings.allowNegativeInventoryValue,
    });

    await this.settingsRepo.saveSettings(updatedSettings);
  }

  async getHistoricalSummary(companyId: string): Promise<{
    hasHistoricalData: boolean;
    movementCount: number;
    earliestDate: string | null;
  }> {
    const hasHistoricalData = await this.stockMovementRepo.hasAnyMovements(companyId);
    let earliestDate: string | null = null;
    let movementCount = 0;
    if (hasHistoricalData) {
      // For now we don't have a count method, but we can return 1+ if data exists
      movementCount = 1; 
    }

    if (hasHistoricalData) {
      const allMovements = await this.stockMovementRepo.getMovementsByDateRange(
        companyId,
        '2000-01-01',
        new Date().toISOString().split('T')[0],
        { limit: 1 }
      );
      earliestDate = allMovements[0]?.date || null;
    }

    return { hasHistoricalData, movementCount, earliestDate };
  }
}
