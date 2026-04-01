import { randomUUID } from 'crypto';
import { StockTransfer, StockTransferStatus } from '../../../domain/inventory/entities/StockTransfer';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockTransferRepository } from '../../../repository/interfaces/inventory/IStockTransferRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { RecordStockMovementUseCase } from './RecordStockMovementUseCase';

export interface CreateStockTransferInput {
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  lines: Array<{
    itemId: string;
    qty: number;
  }>;
  createdBy: string;
}

export interface ListStockTransfersInput {
  status?: StockTransferStatus;
  limit?: number;
  offset?: number;
}

export class CreateStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository
  ) {}

  async execute(input: CreateStockTransferInput): Promise<StockTransfer> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error('date must be in YYYY-MM-DD format');
    }

    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error('Transfer lines are required');
    }

    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      this.warehouseRepo.getWarehouse(input.sourceWarehouseId),
      this.warehouseRepo.getWarehouse(input.destinationWarehouseId),
    ]);

    if (!sourceWarehouse || sourceWarehouse.companyId !== input.companyId) {
      throw new Error(`Source warehouse not found: ${input.sourceWarehouseId}`);
    }

    if (!destinationWarehouse || destinationWarehouse.companyId !== input.companyId) {
      throw new Error(`Destination warehouse not found: ${input.destinationWarehouseId}`);
    }

    const lines = [] as StockTransfer['lines'];

    for (const line of input.lines) {
      if (!line.itemId?.trim()) {
        throw new Error('Transfer line itemId is required');
      }
      if (line.qty <= 0 || Number.isNaN(line.qty)) {
        throw new Error(`Transfer qty must be greater than 0 for item ${line.itemId}`);
      }

      const item = await this.itemRepo.getItem(line.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${line.itemId}`);
      }
      if (!item.trackInventory) {
        throw new Error(`Item is not inventory-tracked: ${line.itemId}`);
      }

      const level = await this.stockLevelRepo.getLevel(input.companyId, line.itemId, input.sourceWarehouseId);
      let unitCostBaseAtTransfer = 0;
      let unitCostCCYAtTransfer = 0;

      if (level) {
        if (level.qtyOnHand > 0) {
          unitCostBaseAtTransfer = level.avgCostBase;
          unitCostCCYAtTransfer = level.avgCostCCY;
        } else if (level.lastCostBase > 0) {
          unitCostBaseAtTransfer = level.lastCostBase;
          unitCostCCYAtTransfer = level.lastCostCCY;
        }
      }

      lines.push({
        itemId: line.itemId,
        qty: line.qty,
        unitCostBaseAtTransfer,
        unitCostCCYAtTransfer,
      });
    }

    const transfer = new StockTransfer({
      id: randomUUID(),
      companyId: input.companyId,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      date: input.date,
      notes: input.notes,
      lines,
      status: 'DRAFT',
      transferPairId: randomUUID(),
      createdBy: input.createdBy,
      createdAt: new Date(),
    });

    await this.transferRepo.createTransfer(transfer);
    return transfer;
  }
}

export class CompleteStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly movementUseCase: RecordStockMovementUseCase,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, transferId: string, userId: string): Promise<StockTransfer> {
    const transfer = await this.transferRepo.getTransfer(transferId);
    if (!transfer || transfer.companyId !== companyId) {
      throw new Error(`Stock transfer not found: ${transferId}`);
    }

    if (transfer.status !== 'DRAFT') {
      throw new Error('Only DRAFT stock transfers can be completed');
    }

    const completedAt = new Date();

    const lineResults = await this.transactionManager.runTransaction(async (txn) => {
      const costs: Array<{ unitCostBase: number; unitCostCCY: number }> = [];

      for (const line of transfer.lines) {
        const result = await this.movementUseCase.processTRANSFER({
          companyId,
          itemId: line.itemId,
          sourceWarehouseId: transfer.sourceWarehouseId,
          destinationWarehouseId: transfer.destinationWarehouseId,
          qty: line.qty,
          date: transfer.date,
          transferDocId: transfer.id,
          transferPairId: transfer.transferPairId,
          transaction: txn,
          currentUser: userId,
          notes: transfer.notes,
          metadata: {
            source: 'stock-transfer',
            transferId: transfer.id,
          },
        });

        costs.push({
          unitCostBase: result.outMov.unitCostBase,
          unitCostCCY: result.outMov.unitCostCCY,
        });
      }

      return costs;
    });

    const completedLines = transfer.lines.map((line, index) => ({
      ...line,
      unitCostBaseAtTransfer: lineResults[index]?.unitCostBase ?? line.unitCostBaseAtTransfer,
      unitCostCCYAtTransfer: lineResults[index]?.unitCostCCY ?? line.unitCostCCYAtTransfer,
    }));

    await this.transferRepo.updateTransfer(transfer.id, {
      status: 'COMPLETED',
      completedAt,
      lines: completedLines,
    } as Partial<StockTransfer>);

    const updated = await this.transferRepo.getTransfer(transfer.id);
    if (!updated) {
      throw new Error(`Stock transfer not found after completion: ${transfer.id}`);
    }

    return updated;
  }
}

export class ListStockTransfersUseCase {
  constructor(private readonly transferRepo: IStockTransferRepository) {}

  async execute(companyId: string, input: ListStockTransfersInput = {}): Promise<StockTransfer[]> {
    if (input.status) {
      return this.transferRepo.getByStatus(companyId, input.status, {
        limit: input.limit,
        offset: input.offset,
      });
    }

    return this.transferRepo.getCompanyTransfers(companyId, {
      limit: input.limit,
      offset: input.offset,
    });
  }
}
