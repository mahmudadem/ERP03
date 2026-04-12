import {
  InventoryProcessINContractInput,
  InventoryProcessOUTContractInput,
  IPurchasesInventoryService,
} from '../contracts/InventoryIntegrationContracts';
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
    });
  }

  async deleteMovement(companyId: string, id: string, transaction?: unknown): Promise<void> {
    return this.movementUseCase.deleteMovement(companyId, id, transaction);
  }
}
