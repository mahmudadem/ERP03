import {
  MovementType,
  ReferenceType,
  StockMovement,
} from '../../../domain/inventory/entities/StockMovement';

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
}

export interface ISalesInventoryService {
  processOUT(input: InventoryProcessOUTContractInput): Promise<StockMovement>;
  processIN(input: InventoryProcessINContractInput): Promise<StockMovement>;
  deleteMovement(companyId: string, id: string, transaction?: unknown): Promise<void>;
}

export interface IPurchasesInventoryService {
  processIN(input: InventoryProcessINContractInput): Promise<StockMovement>;
  processOUT(input: InventoryProcessOUTContractInput): Promise<StockMovement>;
  deleteMovement(companyId: string, id: string, transaction?: unknown): Promise<void>;
}
