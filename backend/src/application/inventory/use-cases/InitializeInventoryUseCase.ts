import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';
import { Uom, UomDimension } from '../../../domain/inventory/entities/Uom';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomRepository } from '../../../repository/interfaces/inventory/IUomRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';

export interface InitializeInventoryInput {
  companyId: string;
  userId: string;
  inventoryAccountingMethod?: 'PERIODIC' | 'PERPETUAL';
  accountingMode?: 'INVOICE_DRIVEN' | 'PERPETUAL';
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
    private readonly uomRepo: IUomRepository,
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
      accountingMode:
        input.accountingMode
        || currentSettings?.accountingMode
        || DocumentPolicyResolver.legacyInventoryMethodToAccountingMode(
          input.inventoryAccountingMethod || currentSettings?.inventoryAccountingMethod || 'PERPETUAL'
        ),
      inventoryAccountingMethod:
        input.inventoryAccountingMethod
        || currentSettings?.inventoryAccountingMethod
        || DocumentPolicyResolver.accountingModeToLegacyInventoryMethod(input.accountingMode || currentSettings?.accountingMode || 'PERPETUAL'),
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
    await this.ensureDefaultUoms(input.companyId, input.userId);

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

  private async ensureDefaultUoms(companyId: string, userId: string): Promise<void> {
    const existing = await this.uomRepo.getCompanyUoms(companyId, { limit: 1 });
    if (existing.length > 0) return;

    const now = new Date();
    const defaults: Array<{ code: string; name: string; dimension: UomDimension; decimalPlaces: number; isSystem?: boolean }> = [
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

    await Promise.all(
      defaults.map((entry) =>
        this.uomRepo.createUom(
          new Uom({
            id: randomUUID(),
            companyId,
            code: entry.code,
            name: entry.name,
            dimension: entry.dimension,
            decimalPlaces: entry.decimalPlaces,
            active: true,
            isSystem: entry.isSystem ?? false,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          })
        )
      )
    );
  }
}
