
export type ItemType = 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
export type ItemCostingMethod = 'MOVING_AVG';

export interface ItemProps {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  type: ItemType;
  categoryId?: string;
  brand?: string;
  tags?: string[];
  baseUomId?: string;
  baseUom: string;
  purchaseUomId?: string;
  purchaseUom?: string;
  salesUomId?: string;
  salesUom?: string;
  costCurrency: string;
  costingMethod: ItemCostingMethod;
  trackInventory: boolean;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAssetAccountId?: string;
  defaultPurchaseTaxCodeId?: string;
  defaultSalesTaxCodeId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  imageUrl?: string;
  metadata?: Record<string, any>;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ITEM_TYPES: ItemType[] = ['PRODUCT', 'SERVICE', 'RAW_MATERIAL'];

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class Item {
  readonly id: string;
  readonly companyId: string;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  type: ItemType;
  categoryId?: string;
  brand?: string;
  tags?: string[];
  baseUomId?: string;
  baseUom: string;
  purchaseUomId?: string;
  purchaseUom?: string;
  salesUomId?: string;
  salesUom?: string;
  costCurrency: string;
  costingMethod: ItemCostingMethod;
  trackInventory: boolean;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAssetAccountId?: string;
  defaultPurchaseTaxCodeId?: string;
  defaultSalesTaxCodeId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  imageUrl?: string;
  metadata?: Record<string, any>;
  active: boolean;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: ItemProps) {
    if (!props.id?.trim()) throw new Error('Item id is required');
    if (!props.companyId?.trim()) throw new Error('Item companyId is required');
    if (!props.code?.trim()) throw new Error('Item code is required');
    if (!props.name?.trim()) throw new Error('Item name is required');
    if (!props.baseUom?.trim()) throw new Error('Item baseUom is required');
    if (!props.costCurrency?.trim()) throw new Error('Item costCurrency is required');
    if (!props.createdBy?.trim()) throw new Error('Item createdBy is required');

    if (!ITEM_TYPES.includes(props.type)) {
      throw new Error(`Invalid item type: ${props.type}`);
    }

    if (props.costingMethod !== 'MOVING_AVG') {
      throw new Error(`Invalid costingMethod: ${props.costingMethod}`);
    }

    if (props.minStockLevel !== undefined && Number.isNaN(props.minStockLevel)) {
      throw new Error('Item minStockLevel must be a valid number');
    }

    if (props.maxStockLevel !== undefined && Number.isNaN(props.maxStockLevel)) {
      throw new Error('Item maxStockLevel must be a valid number');
    }

    if (props.reorderPoint !== undefined && Number.isNaN(props.reorderPoint)) {
      throw new Error('Item reorderPoint must be a valid number');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.code = props.code.trim();
    this.name = props.name.trim();
    this.description = props.description;
    this.barcode = props.barcode;
    this.type = props.type;
    this.categoryId = props.categoryId;
    this.brand = props.brand;
    this.tags = props.tags ? [...props.tags] : undefined;
    this.baseUomId = props.baseUomId;
    this.baseUom = props.baseUom.trim();
    this.purchaseUomId = props.purchaseUomId;
    this.purchaseUom = props.purchaseUom;
    this.salesUomId = props.salesUomId;
    this.salesUom = props.salesUom;
    this.costCurrency = props.costCurrency.toUpperCase().trim();
    this.costingMethod = props.costingMethod;
    this.trackInventory = props.trackInventory;
    this.revenueAccountId = props.revenueAccountId;
    this.cogsAccountId = props.cogsAccountId;
    this.inventoryAssetAccountId = props.inventoryAssetAccountId;
    this.defaultPurchaseTaxCodeId = props.defaultPurchaseTaxCodeId;
    this.defaultSalesTaxCodeId = props.defaultSalesTaxCodeId;
    this.minStockLevel = props.minStockLevel;
    this.maxStockLevel = props.maxStockLevel;
    this.reorderPoint = props.reorderPoint;
    this.imageUrl = props.imageUrl;
    this.metadata = props.metadata ? { ...props.metadata } : undefined;
    this.active = props.active;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  assertCostCurrencyChangeAllowed(newCostCurrency: string, hasMovements: boolean): void {
    const normalized = (newCostCurrency || '').toUpperCase().trim();
    if (!normalized) {
      throw new Error('Item costCurrency is required');
    }

    if (hasMovements && normalized !== this.costCurrency) {
      throw new Error('Item costCurrency cannot be changed after first stock movement');
    }
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      code: this.code,
      name: this.name,
      description: this.description,
      barcode: this.barcode,
      type: this.type,
      categoryId: this.categoryId,
      brand: this.brand,
      tags: this.tags ? [...this.tags] : undefined,
      baseUomId: this.baseUomId,
      baseUom: this.baseUom,
      purchaseUomId: this.purchaseUomId,
      purchaseUom: this.purchaseUom,
      salesUomId: this.salesUomId,
      salesUom: this.salesUom,
      costCurrency: this.costCurrency,
      costingMethod: this.costingMethod,
      trackInventory: this.trackInventory,
      revenueAccountId: this.revenueAccountId,
      cogsAccountId: this.cogsAccountId,
      inventoryAssetAccountId: this.inventoryAssetAccountId,
      defaultPurchaseTaxCodeId: this.defaultPurchaseTaxCodeId,
      defaultSalesTaxCodeId: this.defaultSalesTaxCodeId,
      minStockLevel: this.minStockLevel,
      maxStockLevel: this.maxStockLevel,
      reorderPoint: this.reorderPoint,
      imageUrl: this.imageUrl,
      metadata: this.metadata ? { ...this.metadata } : undefined,
      active: this.active,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): Item {
    return new Item({
      id: data.id,
      companyId: data.companyId,
      code: data.code,
      name: data.name,
      description: data.description,
      barcode: data.barcode,
      type: data.type,
      categoryId: data.categoryId,
      brand: data.brand,
      tags: data.tags,
      baseUomId: data.baseUomId,
      baseUom: data.baseUom || data.unit,
      purchaseUomId: data.purchaseUomId,
      purchaseUom: data.purchaseUom,
      salesUomId: data.salesUomId,
      salesUom: data.salesUom,
      costCurrency: data.costCurrency,
      costingMethod: data.costingMethod || 'MOVING_AVG',
      trackInventory: data.trackInventory ?? data.type !== 'SERVICE',
      revenueAccountId: data.revenueAccountId,
      cogsAccountId: data.cogsAccountId,
      inventoryAssetAccountId: data.inventoryAssetAccountId,
      defaultPurchaseTaxCodeId: data.defaultPurchaseTaxCodeId,
      defaultSalesTaxCodeId: data.defaultSalesTaxCodeId,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
      reorderPoint: data.reorderPoint,
      imageUrl: data.imageUrl,
      metadata: data.metadata,
      active: data.active ?? true,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      updatedAt: toDate(data.updatedAt || new Date()),
    });
  }
}
