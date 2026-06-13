import { randomUUID } from 'crypto';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockTransfer, StockTransferStatus } from '../../../domain/inventory/entities/StockTransfer';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockTransferRepository } from '../../../repository/interfaces/inventory/IStockTransferRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { RecordStockMovementUseCase } from './RecordStockMovementUseCase';

export interface CreateStockTransferInput {
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  mode?: 'FLAT' | 'VALUED';
  lines: Array<{
    itemId: string;
    qty: number;
    /** VALUED mode only: the cost the goods should land at in the destination. */
    unitCostBaseAtTransfer?: number;
    unitCostCCYAtTransfer?: number;
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
      let sourceCostBase = 0;
      let sourceCostCCY = 0;

      if (level) {
        if (level.qtyOnHand > 0) {
          sourceCostBase = level.avgCostBase;
          sourceCostCCY = level.avgCostCCY;
        } else if (level.lastCostBase > 0) {
          sourceCostBase = level.lastCostBase;
          sourceCostCCY = level.lastCostCCY;
        }
      }

      const isValued = input.mode === 'VALUED';
      const hasOverride = isValued && line.unitCostBaseAtTransfer !== undefined && line.unitCostBaseAtTransfer >= 0;

      lines.push({
        itemId: line.itemId,
        qty: line.qty,
        // VALUED + override → the requested landing cost; otherwise the source cost snapshot.
        unitCostBaseAtTransfer: hasOverride ? line.unitCostBaseAtTransfer! : sourceCostBase,
        unitCostCCYAtTransfer: hasOverride
          ? (line.unitCostCCYAtTransfer ?? line.unitCostBaseAtTransfer!)
          : sourceCostCCY,
      });
    }

    const transfer = new StockTransfer({
      id: randomUUID(),
      companyId: input.companyId,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      date: input.date,
      notes: input.notes,
      mode: input.mode || 'FLAT',
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
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly movementUseCase: RecordStockMovementUseCase,
    private readonly transactionManager: ITransactionManager,
    private readonly companyModuleRepo?: ICompanyModuleRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository,
    private readonly accountingPostingService?: SubledgerVoucherPostingService
  ) {}

  async execute(companyId: string, transferId: string, userId: string): Promise<StockTransfer> {
    const transfer = await this.transferRepo.getTransfer(transferId);
    if (!transfer || transfer.companyId !== companyId) {
      throw new Error(`Stock transfer not found: ${transferId}`);
    }

    if (transfer.status !== 'DRAFT') {
      throw new Error('Only DRAFT stock transfers can be completed');
    }

    const isValued = transfer.mode === 'VALUED';
    const completedAt = new Date();

    const lineContexts = await Promise.all(
      transfer.lines.map(async (line) => {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found for transfer line: ${line.itemId}`);
        }
        const [sourceLevel, destinationLevel] = await Promise.all([
          this.stockLevelRepo.getLevel(companyId, line.itemId, transfer.sourceWarehouseId),
          this.stockLevelRepo.getLevel(companyId, line.itemId, transfer.destinationWarehouseId),
        ]);
        return {
          line,
          item,
          sourceLevel: sourceLevel ?? StockLevel.createNew(companyId, line.itemId, transfer.sourceWarehouseId),
          destinationLevel: destinationLevel ?? StockLevel.createNew(companyId, line.itemId, transfer.destinationWarehouseId),
        };
      })
    );

    // Resolve accounting context once (VALUED transfers may post an uplift voucher).
    const shouldPostAccounting = isValued && (await this.isAccountingEnabled(companyId));
    const settings = shouldPostAccounting && this.inventorySettingsRepo
      ? await this.inventorySettingsRepo.getSettings(companyId)
      : null;
    const baseCurrency = shouldPostAccounting
      ? (await this.movementUseCase.preFetchItemContext(companyId, lineContexts[0].line.itemId)).baseCurrency
      : undefined;

    await this.transactionManager.runTransaction(async (txn) => {
      // Each entry: the actual source (OUT) and landed (IN) costs, for GL uplift.
      const completed: Array<{ unitCostBase: number; unitCostCCY: number }> = [];
      // Accumulate the transfer uplift (landed value − source value) per inventory account.
      const upliftByInvAccount = new Map<string, number>();

      for (const context of lineContexts) {
        const result = await this.movementUseCase.processTRANSFER({
          companyId,
          itemId: context.line.itemId,
          sourceWarehouseId: transfer.sourceWarehouseId,
          destinationWarehouseId: transfer.destinationWarehouseId,
          qty: context.line.qty,
          date: transfer.date,
          transferDocId: transfer.id,
          transferPairId: transfer.transferPairId,
          transaction: txn,
          currentUser: userId,
          notes: transfer.notes,
          metadata: {
            source: 'stock-transfer',
            transferId: transfer.id,
            mode: transfer.mode,
          },
          preFetchedItem: context.item,
          preFetchedSourceLevel: context.sourceLevel,
          preFetchedDestinationLevel: context.destinationLevel,
          skipWarehouseValidation: true,
          // VALUED: land the goods at the requested cost; FLAT: inherit source.
          destUnitCostOverrideBase: isValued ? context.line.unitCostBaseAtTransfer : undefined,
          destUnitCostOverrideCCY: isValued ? context.line.unitCostCCYAtTransfer : undefined,
        });

        // Record the actual landed cost on the completed line.
        completed.push({
          unitCostBase: result.inMov.unitCostBase,
          unitCostCCY: result.inMov.unitCostCCY,
        });

        if (shouldPostAccounting) {
          const uplift = roundMoney(result.inMov.totalCostBase - result.outMov.totalCostBase);
          if (uplift !== 0) {
            const invAccountId =
              context.item.inventoryAssetAccountId || settings?.defaultInventoryAssetAccountId;
            if (!invAccountId) {
              throw new Error(
                `Valued transfer cannot post because item ${context.item.code || context.item.id} has no Inventory Asset account. Set it on the item or in Inventory Settings.`
              );
            }
            upliftByInvAccount.set(invAccountId, roundMoney((upliftByInvAccount.get(invAccountId) || 0) + uplift));
          }
        }
      }

      let voucherId: string | undefined;
      if (shouldPostAccounting && this.accountingPostingService) {
        voucherId = await this.postUpliftVoucher(companyId, userId, transfer, upliftByInvAccount, settings, baseCurrency, txn);
      }

      const completedLines = transfer.lines.map((line, index) => ({
        ...line,
        unitCostBaseAtTransfer: completed[index]?.unitCostBase ?? line.unitCostBaseAtTransfer,
        unitCostCCYAtTransfer: completed[index]?.unitCostCCY ?? line.unitCostCCYAtTransfer,
      }));

      await this.transferRepo.updateTransfer(transfer.id, {
        status: 'COMPLETED',
        completedAt,
        lines: completedLines,
        ...(voucherId ? { voucherId } : {}),
      } as Partial<StockTransfer>, txn);
    });

    const updated = await this.transferRepo.getTransfer(transfer.id);
    if (!updated) {
      throw new Error(`Stock transfer not found after completion: ${transfer.id}`);
    }

    return updated;
  }

  /**
   * Posts the VALUED-transfer uplift: for each inventory account, the net uplift
   * is capitalized into inventory (Dr) against the Inventory Transfer Clearing
   * account (Cr). Negative uplift (write-down on transfer) flips the sides.
   * Returns undefined when there is no net uplift to post.
   */
  private async postUpliftVoucher(
    companyId: string,
    userId: string,
    transfer: StockTransfer,
    upliftByInvAccount: Map<string, number>,
    settings: { defaultInventoryTransferClearingAccountId?: string } | null,
    baseCurrency: string | undefined,
    transaction: unknown
  ): Promise<string | undefined> {
    if (!this.accountingPostingService) return undefined;

    const entries = Array.from(upliftByInvAccount.entries()).filter(([, amount]) => Math.abs(amount) > 0.0001);
    if (entries.length === 0) return undefined;

    const clearingAccountId = settings?.defaultInventoryTransferClearingAccountId;
    if (!clearingAccountId) {
      throw new Error(
        'Valued transfer cannot post a cost uplift because no Inventory Transfer Clearing account is configured. Set it in Inventory Settings.'
      );
    }
    if (!baseCurrency) {
      throw new Error(`[Inventory][CompleteStockTransferUseCase] Missing base currency for transfer ${transfer.id}.`);
    }

    const voucherLines: Array<{
      accountId: string;
      side: 'Debit' | 'Credit';
      amount: number;
      currency: string;
      exchangeRate: number;
      baseAmount: number;
      docAmount: number;
      notes: string;
      metadata: Record<string, any>;
    }> = [];

    let netUplift = 0;
    for (const [invAccountId, amount] of entries) {
      const abs = Math.abs(amount);
      netUplift = roundMoney(netUplift + amount);
      voucherLines.push({
        accountId: invAccountId,
        side: amount > 0 ? 'Debit' : 'Credit',
        amount: abs,
        currency: baseCurrency,
        exchangeRate: 1,
        baseAmount: abs,
        docAmount: abs,
        notes: `Stock transfer ${transfer.id} cost uplift`,
        metadata: { source: 'stock-transfer', transferId: transfer.id, role: 'inventory-uplift' },
      });
    }

    // Clearing account takes the balancing side for the net uplift.
    const clearingAbs = Math.abs(netUplift);
    if (clearingAbs > 0.0001) {
      voucherLines.push({
        accountId: clearingAccountId,
        side: netUplift > 0 ? 'Credit' : 'Debit',
        amount: clearingAbs,
        currency: baseCurrency,
        exchangeRate: 1,
        baseAmount: clearingAbs,
        docAmount: clearingAbs,
        notes: `Stock transfer ${transfer.id} clearing`,
        metadata: { source: 'stock-transfer', transferId: transfer.id, role: 'transfer-clearing' },
      });
    }

    const voucher = await this.accountingPostingService.postInTransaction({
      companyId,
      voucherType: VoucherType.JOURNAL_ENTRY,
      voucherNo: `TRF-${transfer.id}`,
      date: transfer.date,
      description: `Stock transfer ${transfer.id} cost uplift`,
      currency: '',
      exchangeRate: 1,
      lines: voucherLines,
      metadata: {
        sourceModule: 'inventory',
        referenceType: 'STOCK_TRANSFER',
        referenceId: transfer.id,
        transferId: transfer.id,
      },
      createdBy: userId,
      postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
      reference: transfer.id,
      baseCurrencyOverride: baseCurrency,
    }, transaction);

    return voucher.id;
  }

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    if (!this.companyModuleRepo) return false;
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
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
