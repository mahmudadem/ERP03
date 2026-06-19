export type LegacyInventoryAccountingMethod = 'PERIODIC' | 'PERPETUAL';
export type InventoryAccountingMode = 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
export type InventoryPricingPolicy = 'AVERAGE' | 'LAST_PURCHASE' | 'STANDARD' | (string & {});
export type InventoryFxCostBasis = 'REPLACEMENT' | 'HISTORICAL';
export type DefaultLinePriceSource = 'PRICE_LIST' | 'LAST_PARTY_PRICE' | 'ITEM_DEFAULT';
/**
 * WAREHOUSE — one moving-average cost per (item, warehouse). Default; precise
 *   per-location valuation; supports valued inter-warehouse transfers.
 * GLOBAL — one company-wide moving-average cost per item (quantity still per
 *   warehouse). Set once at setup; switching after movements exist is unsafe.
 */
export type InventoryCostingBasis = 'WAREHOUSE' | 'GLOBAL';
export type InventoryDefaultCostingMethod = 'MOVING_AVG' | 'STANDARD' | 'FIFO' | (string & {});

export interface InventorySettingsProps {
  companyId: string;
  inventoryAccountingMethod?: LegacyInventoryAccountingMethod;
  accountingMode?: InventoryAccountingMode;
  defaultCostingMethod: InventoryDefaultCostingMethod;
  costingBasis?: InventoryCostingBasis;
  inventoryFxCostBasis?: InventoryFxCostBasis;
  defaultLinePriceSource?: DefaultLinePriceSource;
  defaultCostCurrency: string;
  defaultInventoryAssetAccountId?: string;
  allowNegativeStock: boolean;
  /**
   * When true, posting may proceed for lines whose cost basis is missing/unknown.
   * The movement is recorded with `unsettledCostBasis = 'MISSING'` and the
   * invoice/DN line gets `cogsPostingStatus = 'SKIPPED_UNSETTLED_COST'`. The
   * cost must later be resolved via a settlement/adjustment use case.
   * When false (default), missing cost blocks posting with AccountMappingError.
   * Missing **account mapping** is never deferrable — that always throws.
   */
  allowDeferredCost?: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
  defaultCOGSAccountId?: string;
  /**
   * GL account credited when stock is found / written up (ADJUSTMENT_IN).
   * Standard "inventory gain" / book-to-physical surplus account.
   */
  defaultInventoryGainAccountId?: string;
  /**
   * GL account debited when stock is lost / written down (ADJUSTMENT_OUT) —
   * damage, shrinkage, expiry. Standard "inventory loss / shrinkage" account.
   */
  defaultInventoryLossAccountId?: string;
  /**
   * Clearing account used only by explicit added-cost stock transfers
   * (freight/customs/handling). It must not be used for inferred transfer value.
   */
  defaultInventoryTransferClearingAccountId?: string;
  /**
   * Dedicated account for explicit value-only inventory cost corrections.
   * Used by revaluation transfers and future inventory revaluation documents.
   */
  defaultInventoryRevaluationAccountId?: string;
  /**
   * Default EQUITY offset account for Opening Stock Documents.
   * The document may override it, but posting still validates the chosen account.
   */
  defaultOpeningBalanceAccountId?: string;
  /**
   * Optional escape hatch for negative-value inventory shortcuts. Default false;
   * normal transfer flows should push users to an explicit revaluation instead.
   */
  allowNegativeInventoryValue?: boolean;
}

export class InventorySettings {
  readonly companyId: string;
  inventoryAccountingMethod: LegacyInventoryAccountingMethod;
  accountingMode: InventoryAccountingMode;
  defaultCostingMethod: InventoryDefaultCostingMethod;
  costingBasis: InventoryCostingBasis;
  inventoryFxCostBasis: InventoryFxCostBasis;
  defaultLinePriceSource: DefaultLinePriceSource;
  defaultCostCurrency: string;
  defaultInventoryAssetAccountId?: string;
  allowNegativeStock: boolean;
  allowDeferredCost: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
  defaultCOGSAccountId?: string;
  defaultInventoryGainAccountId?: string;
  defaultInventoryLossAccountId?: string;
  defaultInventoryTransferClearingAccountId?: string;
  defaultInventoryRevaluationAccountId?: string;
  defaultOpeningBalanceAccountId?: string;
  allowNegativeInventoryValue: boolean;

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
    if (!props.defaultCostingMethod?.trim()) {
      throw new Error('InventorySettings defaultCostingMethod is required');
    }
    if (props.itemCodeNextSeq <= 0 || Number.isNaN(props.itemCodeNextSeq)) {
      throw new Error('InventorySettings itemCodeNextSeq must be greater than 0');
    }

    this.companyId = props.companyId;
    this.inventoryAccountingMethod = inventoryAccountingMethod;
    this.accountingMode = accountingMode;
    this.defaultCostingMethod = props.defaultCostingMethod;
    this.costingBasis = props.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';
    this.inventoryFxCostBasis = props.inventoryFxCostBasis === 'HISTORICAL' ? 'HISTORICAL' : 'REPLACEMENT';
    this.defaultLinePriceSource = InventorySettings.normalizeDefaultLinePriceSource(props.defaultLinePriceSource);
    this.defaultCostCurrency = props.defaultCostCurrency.toUpperCase().trim();
    this.defaultInventoryAssetAccountId = props.defaultInventoryAssetAccountId?.trim() || undefined;
    this.allowNegativeStock = props.allowNegativeStock;
    this.allowDeferredCost = props.allowDeferredCost ?? false;
    this.defaultWarehouseId = props.defaultWarehouseId;
    this.autoGenerateItemCode = props.autoGenerateItemCode;
    this.itemCodePrefix = props.itemCodePrefix;
    this.itemCodeNextSeq = props.itemCodeNextSeq;
    this.defaultCOGSAccountId = props.defaultCOGSAccountId?.trim() || undefined;
    this.defaultInventoryGainAccountId = props.defaultInventoryGainAccountId?.trim() || undefined;
    this.defaultInventoryLossAccountId = props.defaultInventoryLossAccountId?.trim() || undefined;
    this.defaultInventoryTransferClearingAccountId =
      props.defaultInventoryTransferClearingAccountId?.trim() || undefined;
    this.defaultInventoryRevaluationAccountId =
      props.defaultInventoryRevaluationAccountId?.trim() || undefined;
    this.defaultOpeningBalanceAccountId = props.defaultOpeningBalanceAccountId?.trim() || undefined;
    this.allowNegativeInventoryValue = props.allowNegativeInventoryValue ?? false;
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
      accountingMode: inventoryAccountingMethod,
      defaultCostingMethod: 'MOVING_AVG',
      inventoryFxCostBasis: 'REPLACEMENT',
      defaultLinePriceSource: 'LAST_PARTY_PRICE',
      defaultCostCurrency: baseCurrency.toUpperCase(),
      defaultInventoryAssetAccountId,
      allowNegativeStock: false,
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
      costingBasis: this.costingBasis,
      inventoryFxCostBasis: this.inventoryFxCostBasis,
      defaultLinePriceSource: this.defaultLinePriceSource,
      defaultCostCurrency: this.defaultCostCurrency,
      defaultInventoryAssetAccountId: this.defaultInventoryAssetAccountId,
      allowNegativeStock: this.allowNegativeStock,
      allowDeferredCost: this.allowDeferredCost,
      defaultWarehouseId: this.defaultWarehouseId,
      autoGenerateItemCode: this.autoGenerateItemCode,
      itemCodePrefix: this.itemCodePrefix,
      itemCodeNextSeq: this.itemCodeNextSeq,
      defaultCOGSAccountId: this.defaultCOGSAccountId,
      defaultInventoryGainAccountId: this.defaultInventoryGainAccountId,
      defaultInventoryLossAccountId: this.defaultInventoryLossAccountId,
      defaultInventoryTransferClearingAccountId: this.defaultInventoryTransferClearingAccountId,
      defaultInventoryRevaluationAccountId: this.defaultInventoryRevaluationAccountId,
      defaultOpeningBalanceAccountId: this.defaultOpeningBalanceAccountId,
      allowNegativeInventoryValue: this.allowNegativeInventoryValue,
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
      costingBasis: data.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE',
      inventoryFxCostBasis: data.inventoryFxCostBasis === 'HISTORICAL' ? 'HISTORICAL' : 'REPLACEMENT',
      defaultLinePriceSource: InventorySettings.normalizeDefaultLinePriceSource(data.defaultLinePriceSource),
      defaultCostCurrency: data.defaultCostCurrency,
      defaultInventoryAssetAccountId: data.defaultInventoryAssetAccountId,
      allowNegativeStock: data.allowNegativeStock ?? false,
      allowDeferredCost: data.allowDeferredCost ?? false,
      defaultWarehouseId: data.defaultWarehouseId,
      autoGenerateItemCode: data.autoGenerateItemCode ?? false,
      itemCodePrefix: data.itemCodePrefix,
      itemCodeNextSeq: data.itemCodeNextSeq ?? 1,
      defaultCOGSAccountId: data.defaultCOGSAccountId,
      defaultInventoryGainAccountId: data.defaultInventoryGainAccountId,
      defaultInventoryLossAccountId: data.defaultInventoryLossAccountId,
      defaultInventoryTransferClearingAccountId: data.defaultInventoryTransferClearingAccountId,
      defaultInventoryRevaluationAccountId: data.defaultInventoryRevaluationAccountId,
      defaultOpeningBalanceAccountId: data.defaultOpeningBalanceAccountId,
      allowNegativeInventoryValue: data.allowNegativeInventoryValue ?? false,
    });
  }

  private static normalizeAccountingMode(
    accountingMode?: InventoryAccountingMode,
    inventoryAccountingMethod?: LegacyInventoryAccountingMethod
  ): InventoryAccountingMode {
    if (accountingMode === 'PERIODIC' || accountingMode === 'INVOICE_DRIVEN' || accountingMode === 'PERPETUAL') {
      return accountingMode;
    }

    if (inventoryAccountingMethod === 'PERIODIC') return 'PERIODIC';
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

  private static normalizeDefaultLinePriceSource(value?: DefaultLinePriceSource): DefaultLinePriceSource {
    if (value === 'LAST_PARTY_PRICE' || value === 'ITEM_DEFAULT') {
      return value;
    }
    return 'LAST_PARTY_PRICE';
  }
}
