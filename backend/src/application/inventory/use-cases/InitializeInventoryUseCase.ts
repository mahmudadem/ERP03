import { randomUUID } from 'crypto';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';

export interface InitializeInventoryInput {
  companyId: string;
  userId: string;
  inventoryAccountingMethod: 'PERIODIC' | 'PERPETUAL';
  defaultWarehouseName?: string;
  defaultWarehouseCode?: string;
  defaultInventoryAssetAccountId?: string;
  defaultCostCurrency?: string;
  allowNegativeStock?: boolean;
  autoGenerateItemCode?: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq?: number;
  defaultCOGSAccountId?: string;
}

export class InitializeInventoryUseCase {
  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly settingsRepo: IInventorySettingsRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository
  ) {}

  async execute(input: InitializeInventoryInput): Promise<{ settings: InventorySettings; defaultWarehouse: Warehouse | null }> {
    const company = await this.companyRepo.findById(input.companyId);
    if (!company) {
      throw new Error(`Company not found: ${input.companyId}`);
    }

    const currentSettings = await this.settingsRepo.getSettings(input.companyId);

    const warehouses = await this.warehouseRepo.getCompanyWarehouses(input.companyId, { limit: 1 });
    let defaultWarehouse: Warehouse | null = warehouses[0] || null;

    if (!defaultWarehouse) {
      const now = new Date();
      defaultWarehouse = new Warehouse({
        id: randomUUID(),
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

    const settings = new InventorySettings({
      companyId: input.companyId,
      inventoryAccountingMethod: input.inventoryAccountingMethod || currentSettings?.inventoryAccountingMethod || 'PERPETUAL',
      defaultCostingMethod: 'MOVING_AVG',
      defaultCostCurrency: input.defaultCostCurrency || currentSettings?.defaultCostCurrency || company.baseCurrency,
      defaultInventoryAssetAccountId:
        input.defaultInventoryAssetAccountId
        ?? currentSettings?.defaultInventoryAssetAccountId
        ?? undefined,
      allowNegativeStock: input.allowNegativeStock ?? currentSettings?.allowNegativeStock ?? true,
      defaultWarehouseId: currentSettings?.defaultWarehouseId || defaultWarehouse.id,
      autoGenerateItemCode: input.autoGenerateItemCode ?? currentSettings?.autoGenerateItemCode ?? false,
      itemCodePrefix: input.itemCodePrefix ?? currentSettings?.itemCodePrefix,
      itemCodeNextSeq: input.itemCodeNextSeq ?? currentSettings?.itemCodeNextSeq ?? 1,
      defaultCOGSAccountId: input.defaultCOGSAccountId ?? currentSettings?.defaultCOGSAccountId,
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
    } else {
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
