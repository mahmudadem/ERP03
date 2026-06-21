import {
  MovementType,
  ReferenceType,
  StockMovement,
} from '../../../domain/inventory/entities/StockMovement';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { Item } from '../../../domain/inventory/entities/Item';

export interface InventoryMovementReferenceInput {
  type: ReferenceType;
  docId?: string;
  lineId?: string;
  reversesMovementId?: string;
  transferPairId?: string;
}

export interface InventoryProcessINContractInput {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qty: number;
  date: string;
  movementType: Extract<
    MovementType,
    'PURCHASE_RECEIPT' | 'OPENING_STOCK' | 'ADJUSTMENT_IN' | 'RETURN_IN' | 'TRANSFER_IN'
  >;
  refs: InventoryMovementReferenceInput;
  currentUser: string;
  unitCostInMoveCurrency: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  notes?: string;
  metadata?: Record<string, any>;
  transaction?: unknown;
  preFetchedStockLevel?: StockLevel;
}

export interface InventoryProcessOUTContractInput {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qty: number;
  date: string;
  movementType: Extract<
    MovementType,
    'SALES_DELIVERY' | 'ADJUSTMENT_OUT' | 'RETURN_OUT' | 'TRANSFER_OUT'
  >;
  refs: InventoryMovementReferenceInput;
  currentUser: string;
  notes?: string;
  metadata?: Record<string, any>;
  transaction?: unknown;
  preFetchedStockLevel?: StockLevel;
  preFetchedItem?: Item;
  skipWarehouseValidation?: boolean;
}

export interface InventoryCOGSAccountResolutionInput {
  item: Item;
  categoriesById?: Map<string, any>;
  defaultCOGSAccountId?: string;
  defaultInventoryAssetAccountId?: string;
}

export interface InventoryCOGSAccounts {
  cogsAccountId: string;
  inventoryAccountId: string;
}

export interface InventoryCOGSBucketLine {
  cogsAccountId: string;
  inventoryAccountId: string;
  amountBase: number;
}

export interface IInventoryCore {
  processOUT(input: InventoryProcessOUTContractInput): Promise<StockMovement>;
  processIN(input: InventoryProcessINContractInput): Promise<StockMovement>;
  deleteMovement(companyId: string, id: string, transaction?: unknown): Promise<void>;
  preFetchStockLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null>;
  preFetchLevelsByItem(companyId: string, itemId: string): Promise<StockLevel[]>;
  writeStockMovement(movement: StockMovement, transaction?: unknown): Promise<void>;
  writeStockLevel(level: StockLevel, transaction?: unknown): Promise<void>;
  resolveCOGSAccounts(input: InventoryCOGSAccountResolutionInput): InventoryCOGSAccounts | null;
  addToCOGSBucket(bucket: Map<string, InventoryCOGSBucketLine>, cogsAccountId: string, inventoryAccountId: string, amountBase: number): void;
}

export const resolveInventoryCOGSAccounts = (input: InventoryCOGSAccountResolutionInput): InventoryCOGSAccounts | null => {
  const category = input.item.categoryId ? input.categoriesById?.get(input.item.categoryId) : null;
  const cogsAccountId = input.item.cogsAccountId || category?.defaultCogsAccountId || input.defaultCOGSAccountId;
  const inventoryAccountId = input.item.inventoryAssetAccountId || category?.defaultInventoryAssetAccountId || input.defaultInventoryAssetAccountId;
  return cogsAccountId && inventoryAccountId ? { cogsAccountId, inventoryAccountId } : null;
};

export const addInventoryCOGSToBucket = (
  bucket: Map<string, InventoryCOGSBucketLine>,
  cogsAccountId: string,
  inventoryAccountId: string,
  amountBase: number
): void => {
  const roundedAmount = Math.round((amountBase + Number.EPSILON) * 100) / 100;
  const key = `${cogsAccountId}|${inventoryAccountId}`;
  const existing = bucket.get(key);
  if (existing) {
    existing.amountBase = Math.round((existing.amountBase + roundedAmount + Number.EPSILON) * 100) / 100;
    return;
  }
  bucket.set(key, { cogsAccountId, inventoryAccountId, amountBase: roundedAmount });
};

export const ensureInventoryCore = <T extends Partial<IInventoryCore>>(service: T): T & IInventoryCore => {
  const target = service as T & IInventoryCore;
  if (typeof target.resolveCOGSAccounts !== 'function') {
    target.resolveCOGSAccounts = resolveInventoryCOGSAccounts;
  }
  if (typeof target.addToCOGSBucket !== 'function') {
    target.addToCOGSBucket = addInventoryCOGSToBucket;
  }
  return target;
};

/** @deprecated Use IInventoryCore. Kept for one phase while call sites finish migrating. */
export type ISalesInventoryService = IInventoryCore;

/** @deprecated Use IInventoryCore. Kept for one phase while call sites finish migrating. */
export type IPurchasesInventoryService = IInventoryCore;
