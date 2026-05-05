import {
  InventoryProcessINContractInput,
  InventoryProcessOUTContractInput,
  IPurchasesInventoryService,
} from '../contracts/InventoryIntegrationContracts';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { RecordStockMovementUseCase } from '../use-cases/RecordStockMovementUseCase';

export class PurchasesInventoryService implements IPurchasesInventoryService {
  constructor(private readonly movementUseCase: RecordStockMovementUseCase) {}

  processIN(input: InventoryProcessINContractInput) {
    return this.movementUseCase.processIN({
      companyId: input.companyId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      qty: input.qty,
      date: input.date,
      movementType: input.movementType,
      refs: input.refs,
      currentUser: input.currentUser,
      unitCostInMoveCurrency: input.unitCostInMoveCurrency,
      moveCurrency: input.moveCurrency,
      fxRateMovToBase: input.fxRateMovToBase,
      fxRateCCYToBase: input.fxRateCCYToBase,
      notes: input.notes,
      metadata: input.metadata,
      transaction: input.transaction,
      preFetchedLevel: input.preFetchedStockLevel,
    });
  }

  processOUT(input: InventoryProcessOUTContractInput) {
    return this.movementUseCase.processOUT({
      companyId: input.companyId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      qty: input.qty,
      date: input.date,
      movementType: input.movementType,
      refs: input.refs,
      currentUser: input.currentUser,
      notes: input.notes,
      metadata: input.metadata,
      transaction: input.transaction,
      preFetchedLevel: input.preFetchedStockLevel,
      preFetchedItem: input.preFetchedItem,
      skipWarehouseValidation: input.skipWarehouseValidation,
    });
  }

  async deleteMovement(companyId: string, id: string, transaction?: unknown): Promise<void> {
    return this.movementUseCase.deleteMovement(companyId, id, transaction);
  }

  preFetchStockLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    return this.movementUseCase.preFetchStockLevel(companyId, itemId, warehouseId);
  }

  writeStockMovement(movement: StockMovement, transaction?: unknown): Promise<void> {
    return this.movementUseCase.writeStockMovement(movement, transaction);
  }

  writeStockLevel(level: StockLevel, transaction?: unknown): Promise<void> {
    return this.movementUseCase.writeStockLevel(level, transaction);
  }
}