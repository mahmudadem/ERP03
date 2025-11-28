
import { StockMovement, StockDirection } from '../../../domain/inventory/entities/StockMovement';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory';

export class RecordStockMovementUseCase {
  constructor(private repo: IStockMovementRepository) {}

  async execute(data: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    qty: number;
    direction: StockDirection;
    referenceType: 'VOUCHER' | 'POS_ORDER' | 'ADJUSTMENT' | 'TRANSFER';
    referenceId: string;
  }): Promise<void> {
    const movement = new StockMovement(
      `sm_${Date.now()}`,
      data.companyId,
      data.itemId,
      data.warehouseId,
      data.qty,
      data.direction,
      data.referenceType,
      data.referenceId,
      new Date()
    );
    await this.repo.recordMovement(movement);
  }
}

export class TransferStockBetweenWarehousesUseCase {
  constructor(private repo: IStockMovementRepository) {}

  async execute(data: {
    companyId: string;
    itemId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    qty: number;
  }): Promise<void> {
    const refId = `tx_${Date.now()}`;
    
    // Out from source
    await this.repo.recordMovement(new StockMovement(
      `sm_out_${Date.now()}`,
      data.companyId,
      data.itemId,
      data.fromWarehouseId,
      data.qty,
      'OUT',
      'TRANSFER',
      refId,
      new Date()
    ));

    // In to destination
    await this.repo.recordMovement(new StockMovement(
      `sm_in_${Date.now()}`,
      data.companyId,
      data.itemId,
      data.toWarehouseId,
      data.qty,
      'IN',
      'TRANSFER',
      refId,
      new Date()
    ));
  }
}
