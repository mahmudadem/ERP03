export type LegacyInventoryAccountingMethod = 'PERIODIC' | 'PERPETUAL';
export type InventoryAccountingMode = 'INVOICE_DRIVEN' | 'PERPETUAL';

export interface InventorySettingsProps {
  companyId: string;
  inventoryAccountingMethod?: LegacyInventoryAccountingMethod;
  accountingMode?: InventoryAccountingMode;
  defaultCostingMethod: 'MOVING_AVG';
  defaultCostCurrency: string;
  defaultInventoryAssetAccountId?: string;
  allowNegativeStock: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
  defaultCOGSAccountId?: string;
}

export class InventorySettings {
  readonly companyId: string;
  inventoryAccountingMethod: LegacyInventoryAccountingMethod;
  accountingMode: InventoryAccountingMode;
  defaultCostingMethod: 'MOVING_AVG';
  defaultCostCurrency: string;
  defaultInventoryAssetAccountId?: string;
  allowNegativeStock: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
  defaultCOGSAccountId?: string;

  constructor(props: InventorySettingsProps) {
    if (!props.companyId?.trim()) throw new Error('InventorySettings companyId is required');
    if (!props.defaultCostCurrency?.trim()) throw new Error('InventorySettings defaultCostCurrency is required');
    const accountingMode = InventorySettings.normalizeAccountingMode(
      props.accountingMode,
      props.inventoryAccountingMethod
    );
    const inventoryAccountingMethod = InventorySettings.normalizeLegacyMethod(
      props.inventoryAccountingMethod,
      accountingMode
    );
    // Note: Requiredness for defaultInventoryAssetAccountId in PERPETUAL mode 
    // is enforced at the Use Case and Validator level to allow hydration of partial legacy data.
    if (props.defaultCostingMethod !== 'MOVING_AVG') {
      throw new Error(`Invalid defaultCostingMethod: ${props.defaultCostingMethod}`);
    }
    if (props.itemCodeNextSeq <= 0 || Number.isNaN(props.itemCodeNextSeq)) {
      throw new Error('InventorySettings itemCodeNextSeq must be greater than 0');
    }

    this.companyId = props.companyId;
    this.inventoryAccountingMethod = inventoryAccountingMethod;
    this.accountingMode = accountingMode;
    this.defaultCostingMethod = props.defaultCostingMethod;
    this.defaultCostCurrency = props.defaultCostCurrency.toUpperCase().trim();
    this.defaultInventoryAssetAccountId = props.defaultInventoryAssetAccountId?.trim() || undefined;
    this.allowNegativeStock = props.allowNegativeStock;
    this.defaultWarehouseId = props.defaultWarehouseId;
    this.autoGenerateItemCode = props.autoGenerateItemCode;
    this.itemCodePrefix = props.itemCodePrefix;
    this.itemCodeNextSeq = props.itemCodeNextSeq;
    this.defaultCOGSAccountId = props.defaultCOGSAccountId?.trim() || undefined;
  }

  static createDefault(
    companyId: string,
    baseCurrency: string,
    inventoryAccountingMethod: LegacyInventoryAccountingMethod = 'PERPETUAL',
    defaultInventoryAssetAccountId?: string
  ): InventorySettings {
    return new InventorySettings({
      companyId,
      inventoryAccountingMethod,
      accountingMode: inventoryAccountingMethod === 'PERPETUAL' ? 'PERPETUAL' : 'INVOICE_DRIVEN',
      defaultCostingMethod: 'MOVING_AVG',
      defaultCostCurrency: baseCurrency.toUpperCase(),
      defaultInventoryAssetAccountId,
      allowNegativeStock: true,
      autoGenerateItemCode: false,
      itemCodeNextSeq: 1,
    });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      accountingMode: this.accountingMode,
      inventoryAccountingMethod: this.inventoryAccountingMethod,
      defaultCostingMethod: this.defaultCostingMethod,
      defaultCostCurrency: this.defaultCostCurrency,
      defaultInventoryAssetAccountId: this.defaultInventoryAssetAccountId,
      allowNegativeStock: this.allowNegativeStock,
      defaultWarehouseId: this.defaultWarehouseId,
      autoGenerateItemCode: this.autoGenerateItemCode,
      itemCodePrefix: this.itemCodePrefix,
      itemCodeNextSeq: this.itemCodeNextSeq,
      defaultCOGSAccountId: this.defaultCOGSAccountId,
    };
  }

  static fromJSON(data: any): InventorySettings {
    return new InventorySettings({
      companyId: data.companyId,
      accountingMode: InventorySettings.normalizeAccountingMode(data.accountingMode, data.inventoryAccountingMethod),
      inventoryAccountingMethod: InventorySettings.normalizeLegacyMethod(
        data.inventoryAccountingMethod,
        InventorySettings.normalizeAccountingMode(data.accountingMode, data.inventoryAccountingMethod)
      ),
      defaultCostingMethod: data.defaultCostingMethod || 'MOVING_AVG',
      defaultCostCurrency: data.defaultCostCurrency,
      defaultInventoryAssetAccountId: data.defaultInventoryAssetAccountId,
      allowNegativeStock: data.allowNegativeStock ?? true,
      defaultWarehouseId: data.defaultWarehouseId,
      autoGenerateItemCode: data.autoGenerateItemCode ?? false,
      itemCodePrefix: data.itemCodePrefix,
      itemCodeNextSeq: data.itemCodeNextSeq ?? 1,
      defaultCOGSAccountId: data.defaultCOGSAccountId,
    });
  }

  private static normalizeAccountingMode(
    accountingMode?: InventoryAccountingMode,
    inventoryAccountingMethod?: LegacyInventoryAccountingMethod
  ): InventoryAccountingMode {
    if (accountingMode === 'INVOICE_DRIVEN' || accountingMode === 'PERPETUAL') {
      return accountingMode;
    }

    if (inventoryAccountingMethod === 'PERIODIC') return 'INVOICE_DRIVEN';
    if (inventoryAccountingMethod === 'PERPETUAL') return 'PERPETUAL';

    return 'PERPETUAL';
  }

  private static normalizeLegacyMethod(
    inventoryAccountingMethod: LegacyInventoryAccountingMethod | undefined,
    accountingMode: InventoryAccountingMode
  ): LegacyInventoryAccountingMethod {
    if (inventoryAccountingMethod === 'PERIODIC' || inventoryAccountingMethod === 'PERPETUAL') {
      return inventoryAccountingMethod;
    }
    return accountingMode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC';
  }
}
