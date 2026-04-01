export interface InventorySettingsProps {
  companyId: string;
  defaultCostingMethod: 'MOVING_AVG';
  defaultCostCurrency: string;
  allowNegativeStock: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
}

export class InventorySettings {
  readonly companyId: string;
  defaultCostingMethod: 'MOVING_AVG';
  defaultCostCurrency: string;
  allowNegativeStock: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;

  constructor(props: InventorySettingsProps) {
    if (!props.companyId?.trim()) throw new Error('InventorySettings companyId is required');
    if (!props.defaultCostCurrency?.trim()) throw new Error('InventorySettings defaultCostCurrency is required');
    if (props.defaultCostingMethod !== 'MOVING_AVG') {
      throw new Error(`Invalid defaultCostingMethod: ${props.defaultCostingMethod}`);
    }
    if (props.itemCodeNextSeq <= 0 || Number.isNaN(props.itemCodeNextSeq)) {
      throw new Error('InventorySettings itemCodeNextSeq must be greater than 0');
    }

    this.companyId = props.companyId;
    this.defaultCostingMethod = props.defaultCostingMethod;
    this.defaultCostCurrency = props.defaultCostCurrency.toUpperCase().trim();
    this.allowNegativeStock = props.allowNegativeStock;
    this.defaultWarehouseId = props.defaultWarehouseId;
    this.autoGenerateItemCode = props.autoGenerateItemCode;
    this.itemCodePrefix = props.itemCodePrefix;
    this.itemCodeNextSeq = props.itemCodeNextSeq;
  }

  static createDefault(companyId: string, baseCurrency: string): InventorySettings {
    return new InventorySettings({
      companyId,
      defaultCostingMethod: 'MOVING_AVG',
      defaultCostCurrency: baseCurrency.toUpperCase(),
      allowNegativeStock: true,
      autoGenerateItemCode: false,
      itemCodeNextSeq: 1,
    });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      defaultCostingMethod: this.defaultCostingMethod,
      defaultCostCurrency: this.defaultCostCurrency,
      allowNegativeStock: this.allowNegativeStock,
      defaultWarehouseId: this.defaultWarehouseId,
      autoGenerateItemCode: this.autoGenerateItemCode,
      itemCodePrefix: this.itemCodePrefix,
      itemCodeNextSeq: this.itemCodeNextSeq,
    };
  }

  static fromJSON(data: any): InventorySettings {
    return new InventorySettings({
      companyId: data.companyId,
      defaultCostingMethod: data.defaultCostingMethod || 'MOVING_AVG',
      defaultCostCurrency: data.defaultCostCurrency,
      allowNegativeStock: data.allowNegativeStock ?? true,
      defaultWarehouseId: data.defaultWarehouseId,
      autoGenerateItemCode: data.autoGenerateItemCode ?? false,
      itemCodePrefix: data.itemCodePrefix,
      itemCodeNextSeq: data.itemCodeNextSeq ?? 1,
    });
  }
}
