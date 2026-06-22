import {
  CostSource,
  MovementType,
  ReferenceType,
  StockMovement,
} from '../../../domain/inventory/entities/StockMovement';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { Item } from '../../../domain/inventory/entities/Item';
import { roundMoney } from '../../system-core/money/roundMoney';

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

// ---------------------------------------------------------------------------
// Stock movement construction (FUP-4): owned by the inventory core so source
// modules (Sales SI/DN/SR) delegate instead of hand-rolling StockMovement /
// StockLevel. These are faithful extractions of the previous inline Sales
// orchestration — they mutate the passed `level` IN PLACE (preserving the
// running-level threading across multi-line invoices) and build the movement
// with identical costing (moving-average issue cost + settled/unsettled qty).
// ---------------------------------------------------------------------------

/** Clone a stock level so the caller can mutate a working copy without touching cached reads. */
export const cloneStockLevel = (level: StockLevel): StockLevel => StockLevel.fromJSON(level.toJSON());

/** Create a fresh zeroed stock level for an item/warehouse that has no prior movements. */
export const createStockLevel = (companyId: string, itemId: string, warehouseId: string): StockLevel =>
  StockLevel.createNew(companyId, itemId, warehouseId);

export interface ComputeStockMovementResult {
  movement: StockMovement;
  unitCostBase: number;
  lineCostBase: number;
}

export interface ComputeStockOutMovementInput {
  companyId: string;
  item: Item;
  /** Mutated in place to reflect the OUT (qtyOnHand, postingSeq, version, etc.). */
  level: StockLevel;
  warehouseId: string;
  qtyInBaseUom: number;
  date: string;
  createdBy: string;
  movementType: Extract<MovementType, 'SALES_DELIVERY' | 'ADJUSTMENT_OUT' | 'RETURN_OUT' | 'TRANSFER_OUT'>;
  referenceType: ReferenceType;
  referenceId: string;
  referenceLineId?: string;
  costSource?: CostSource;
  metadata?: Record<string, any>;
}

/** Compute a stock OUT movement (moving-average issue costing) and mutate the level in place. */
export const computeStockOutMovement = (input: ComputeStockOutMovementInput): ComputeStockMovementResult => {
  const { item, level, qtyInBaseUom } = input;
  const qtyBefore = level.qtyOnHand;
  const oldMaxBusinessDate = level.maxBusinessDate;

  let issueCostBase = 0;
  let issueCostCCY = 0;
  let costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';
  if (qtyBefore > 0) {
    issueCostBase = level.avgCostBase;
    issueCostCCY = level.avgCostCCY;
    costBasis = 'AVG';
  } else if (level.lastCostBase > 0) {
    issueCostBase = level.lastCostBase;
    issueCostCCY = level.lastCostCCY;
    costBasis = 'LAST_KNOWN';
  }

  const settledQty = Math.min(qtyInBaseUom, Math.max(qtyBefore, 0));
  const unsettledQty = qtyInBaseUom - settledQty;
  const effectiveFxCCYToBase = issueCostCCY > 0 ? issueCostBase / issueCostCCY : 1.0;

  const movement = new StockMovement({
    id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    companyId: input.companyId,
    date: input.date,
    postingSeq: level.postingSeq + 1,
    createdAt: new Date(),
    createdBy: input.createdBy,
    postedAt: new Date(),
    itemId: item.id,
    warehouseId: input.warehouseId,
    direction: 'OUT',
    movementType: input.movementType,
    qty: qtyInBaseUom,
    uom: item.baseUom,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceLineId: input.referenceLineId,
    reversesMovementId: undefined,
    transferPairId: undefined,
    unitCostBase: issueCostBase,
    totalCostBase: roundMoney(issueCostBase * qtyInBaseUom),
    unitCostCCY: issueCostCCY,
    totalCostCCY: roundMoney(issueCostCCY * qtyInBaseUom),
    movementCurrency: item.costCurrency,
    fxRateMovToBase: effectiveFxCCYToBase,
    fxRateCCYToBase: effectiveFxCCYToBase,
    fxRateKind: 'EFFECTIVE',
    avgCostBaseAfter: level.avgCostBase,
    avgCostCCYAfter: level.avgCostCCY,
    qtyBefore,
    qtyAfter: qtyBefore - qtyInBaseUom,
    settledQty,
    unsettledQty,
    unsettledCostBasis: unsettledQty > 0 ? costBasis : undefined,
    negativeQtyAtPosting: (qtyBefore - qtyInBaseUom) < 0,
    costSettled: unsettledQty === 0,
    isBackdated: input.date < oldMaxBusinessDate,
    costSource: input.costSource ?? 'PURCHASE',
    notes: undefined,
    metadata: input.metadata,
  });

  level.qtyOnHand -= qtyInBaseUom;
  level.postingSeq += 1;
  level.version += 1;
  level.totalMovements += 1;
  level.maxBusinessDate = input.date > oldMaxBusinessDate ? input.date : oldMaxBusinessDate;
  level.updatedAt = new Date();
  level.lastMovementId = movement.id;

  const unitCostBase = roundMoney(movement.unitCostBase || 0);
  const lineCostBase = roundMoney(qtyInBaseUom * unitCostBase);
  return { movement, unitCostBase, lineCostBase };
};

export interface ComputeStockReturnInMovementInput {
  companyId: string;
  item: Item;
  /** Mutated in place to reflect the IN (qtyOnHand, weighted avg cost, etc.). */
  level: StockLevel;
  warehouseId: string;
  qtyInBaseUom: number;
  date: string;
  createdBy: string;
  unitCostBase: number;
  unitCostInMoveCurrency: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  movementCurrency: string;
  referenceType: ReferenceType;
  referenceId: string;
  referenceLineId?: string;
  metadata?: Record<string, any>;
}

/** Compute a RETURN_IN movement (weighted-average cost recompute) and mutate the level in place. */
export const computeStockReturnInMovement = (input: ComputeStockReturnInMovementInput): ComputeStockMovementResult => {
  const { item, level, qtyInBaseUom, unitCostBase, unitCostInMoveCurrency } = input;
  const qtyBefore = level.qtyOnHand;
  const oldMaxBusinessDate = level.maxBusinessDate;

  let newAvgBase = unitCostBase;
  let newAvgCCY = unitCostInMoveCurrency;
  if (qtyBefore > 0) {
    const newQty = qtyBefore + qtyInBaseUom;
    newAvgBase = roundMoney(((level.avgCostBase * qtyBefore) + (unitCostBase * qtyInBaseUom)) / newQty);
    newAvgCCY = roundMoney(((level.avgCostCCY * qtyBefore) + (unitCostInMoveCurrency * qtyInBaseUom)) / newQty);
  }
  const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
  const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
  const qtyAfter = qtyBefore + qtyInBaseUom;

  const movement = new StockMovement({
    id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    companyId: input.companyId,
    date: input.date,
    postingSeq: level.postingSeq + 1,
    createdAt: new Date(),
    createdBy: input.createdBy,
    postedAt: new Date(),
    itemId: item.id,
    warehouseId: input.warehouseId,
    direction: 'IN',
    movementType: 'RETURN_IN',
    qty: qtyInBaseUom,
    uom: item.baseUom,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceLineId: input.referenceLineId,
    unitCostBase,
    totalCostBase: roundMoney(unitCostBase * qtyInBaseUom),
    unitCostCCY: newAvgCCY,
    totalCostCCY: roundMoney(newAvgCCY * qtyInBaseUom),
    movementCurrency: input.movementCurrency,
    fxRateMovToBase: input.fxRateMovToBase,
    fxRateCCYToBase: input.fxRateCCYToBase,
    fxRateKind: 'DOCUMENT',
    avgCostBaseAfter: newAvgBase,
    avgCostCCYAfter: newAvgCCY,
    qtyBefore,
    qtyAfter,
    settlesNegativeQty,
    newPositiveQty,
    negativeQtyAtPosting: qtyAfter < 0,
    costSettled: unitCostBase > 0,
    isBackdated: input.date < oldMaxBusinessDate,
    costSource: 'RETURN',
    metadata: input.metadata,
  });

  level.qtyOnHand += qtyInBaseUom;
  level.avgCostBase = newAvgBase;
  level.avgCostCCY = newAvgCCY;
  level.lastCostBase = unitCostBase;
  level.lastCostCCY = newAvgCCY;
  level.postingSeq += 1;
  level.version += 1;
  level.totalMovements += 1;
  level.maxBusinessDate = input.date > oldMaxBusinessDate ? input.date : oldMaxBusinessDate;
  level.updatedAt = new Date();
  level.lastMovementId = movement.id;

  const lineCostBase = roundMoney(unitCostBase * qtyInBaseUom);
  return { movement, unitCostBase: roundMoney(unitCostBase), lineCostBase };
};

/** @deprecated Use IInventoryCore. Kept for one phase while call sites finish migrating. */
export type ISalesInventoryService = IInventoryCore;

/** @deprecated Use IInventoryCore. Kept for one phase while call sites finish migrating. */
export type IPurchasesInventoryService = IInventoryCore;
