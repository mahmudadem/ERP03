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
import { postFinancialEvent } from '../../accounting/services/postFinancialEvent';
import { IAccountingBridge } from '../../system-core/contracts/IAccountingBridge';
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
    /** Deprecated input; use revaluationUnitCost* for explicit revaluations. */
    unitCostBaseAtTransfer?: number;
    unitCostCCYAtTransfer?: number;
    /** Real added cost for this line, e.g. freight/customs/handling. */
    addedCostBaseAtTransfer?: number;
    addedCostCCYAtTransfer?: number;
    /** Explicit revaluation landing unit cost for this line. */
    revaluationUnitCostBaseAtTransfer?: number;
    revaluationUnitCostCCYAtTransfer?: number;
    notes?: string;
  }>;
  createdBy: string;
}

export interface UpdateStockTransferInput extends CreateStockTransferInput {
  transferId: string;
}

export interface ListStockTransfersInput {
  status?: StockTransferStatus;
  limit?: number;
  offset?: number;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export class CreateStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository
  ) {}

  async execute(input: CreateStockTransferInput): Promise<StockTransfer> {
    const transfer = await this.buildDraft(input);
    await this.transferRepo.createTransfer(transfer);
    return transfer;
  }

  async buildDraft(input: CreateStockTransferInput): Promise<StockTransfer> {
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

      const addedCostBase = line.addedCostBaseAtTransfer ?? 0;
      const addedCostCCY = line.addedCostCCYAtTransfer ?? addedCostBase;
      const hasAddedCost = addedCostBase > 0 || addedCostCCY > 0;
      const hasRevaluation =
        line.revaluationUnitCostBaseAtTransfer !== undefined ||
        line.revaluationUnitCostCCYAtTransfer !== undefined;
      const hasLegacyOverride =
        line.unitCostBaseAtTransfer !== undefined ||
        line.unitCostCCYAtTransfer !== undefined;

      if (hasAddedCost && hasRevaluation) {
        throw new Error('Added cost and revaluation must be posted as separate stock transfers');
      }
      if (hasLegacyOverride && !hasAddedCost && !hasRevaluation) {
        throw new Error(
          'Valued stock transfers must declare addedCostBaseAtTransfer or revaluationUnitCostBaseAtTransfer; landed cost is no longer accepted as an implicit uplift.'
        );
      }

      lines.push({
        itemId: line.itemId,
        qty: line.qty,
        unitCostBaseAtTransfer: sourceCostBase,
        unitCostCCYAtTransfer: sourceCostCCY,
        addedCostBaseAtTransfer: hasAddedCost ? addedCostBase : undefined,
        addedCostCCYAtTransfer: hasAddedCost ? addedCostCCY : undefined,
        revaluationUnitCostBaseAtTransfer: hasRevaluation
          ? (line.revaluationUnitCostBaseAtTransfer ?? line.revaluationUnitCostCCYAtTransfer ?? 0)
          : undefined,
        revaluationUnitCostCCYAtTransfer: hasRevaluation
          ? (line.revaluationUnitCostCCYAtTransfer ?? line.revaluationUnitCostBaseAtTransfer ?? 0)
          : undefined,
        notes: line.notes || undefined,
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
    return transfer;
  }
}

export class UpdateStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly createUseCase: CreateStockTransferUseCase
  ) {}

  async execute(input: UpdateStockTransferInput): Promise<StockTransfer> {
    const existing = await this.transferRepo.getTransfer(input.transferId);
    if (!existing || existing.companyId !== input.companyId) {
      throw new Error(`Stock transfer not found: ${input.transferId}`);
    }
    if (existing.status !== 'DRAFT') {
      throw new Error('Only DRAFT stock transfers can be edited');
    }

    const candidate = await this.createUseCase.buildDraft({
      companyId: input.companyId,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      date: input.date,
      notes: input.notes,
      mode: input.mode,
      lines: input.lines,
      createdBy: input.createdBy,
    });

    await this.transferRepo.updateTransfer(existing.id, {
      sourceWarehouseId: candidate.sourceWarehouseId,
      destinationWarehouseId: candidate.destinationWarehouseId,
      date: candidate.date,
      notes: candidate.notes,
      mode: candidate.mode,
      lines: candidate.lines,
    } as Partial<StockTransfer>);

    const updated = await this.transferRepo.getTransfer(existing.id);
    if (!updated) {
      throw new Error(`Stock transfer not found after update: ${existing.id}`);
    }
    return updated;
  }
}

export class CompleteStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly movementUseCase: RecordStockMovementUseCase,
    private readonly transactionManager: ITransactionManager,
    private readonly companyModuleRepo: ICompanyModuleRepository | undefined,
    private readonly inventorySettingsRepo: IInventorySettingsRepository | undefined,
    private readonly accountingBridge: IAccountingBridge
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

    // Resolve accounting context once (VALUED transfers may post explicit deltas).
    const shouldPostAccounting = isValued && (await this.isAccountingEnabled(companyId));
    const settings = shouldPostAccounting && this.inventorySettingsRepo
      ? await this.inventorySettingsRepo.getSettings(companyId)
      : null;
    const baseCurrency = shouldPostAccounting
      ? (await this.movementUseCase.preFetchItemContext(companyId, lineContexts[0].line.itemId)).baseCurrency
      : undefined;

    await this.transactionManager.runTransaction(async (txn) => {
      // Each entry: the actual source (OUT) and landed (IN) costs.
      const completed: Array<{ unitCostBase: number; unitCostCCY: number }> = [];
      const addedCostByInvAccount = new Map<string, number>();
      const revaluationByInvAccount = new Map<string, number>();

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
          addedCostBase: isValued ? context.line.addedCostBaseAtTransfer : undefined,
          addedCostCCY: isValued ? context.line.addedCostCCYAtTransfer : undefined,
          revaluationUnitCostBase: isValued ? context.line.revaluationUnitCostBaseAtTransfer : undefined,
          revaluationUnitCostCCY: isValued ? context.line.revaluationUnitCostCCYAtTransfer : undefined,
        });

        // Record the actual landed cost on the completed line.
        completed.push({
          unitCostBase: result.inMov.unitCostBase,
          unitCostCCY: result.inMov.unitCostCCY,
        });

        if (shouldPostAccounting) {
          const invAccountId = context.item.inventoryAssetAccountId || settings?.defaultInventoryAssetAccountId;
          const explicitAddedCost = roundMoney(context.line.addedCostBaseAtTransfer ?? 0);
          const explicitRevaluationDelta =
            context.line.revaluationUnitCostBaseAtTransfer !== undefined
              ? roundMoney((context.line.revaluationUnitCostBaseAtTransfer - result.outMov.unitCostBase) * context.line.qty)
              : 0;

          if ((explicitAddedCost !== 0 || explicitRevaluationDelta !== 0) && !invAccountId) {
            throw new Error(
              `Valued transfer cannot post because item ${context.item.code || context.item.id} has no Inventory Asset account. Set it on the item or in Inventory Settings.`
            );
          }
          if (explicitAddedCost !== 0) {
            addedCostByInvAccount.set(invAccountId!, roundMoney((addedCostByInvAccount.get(invAccountId!) || 0) + explicitAddedCost));
          }
          if (explicitRevaluationDelta !== 0) {
            revaluationByInvAccount.set(invAccountId!, roundMoney((revaluationByInvAccount.get(invAccountId!) || 0) + explicitRevaluationDelta));
          }
        }
      }

      let voucherId: string | undefined;
      if (shouldPostAccounting) {
        voucherId = await this.postUpliftVoucher(
          companyId,
          userId,
          transfer,
          addedCostByInvAccount,
          revaluationByInvAccount,
          settings,
          baseCurrency,
          txn
        );
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
   * Posts explicit VALUED-transfer deltas only. Plain/journaled transfers are
   * value-neutral with the current single inventory control account model.
   */
  private async postUpliftVoucher(
    companyId: string,
    userId: string,
    transfer: StockTransfer,
    addedCostByInvAccount: Map<string, number>,
    revaluationByInvAccount: Map<string, number>,
    settings: {
      defaultInventoryTransferClearingAccountId?: string;
      defaultInventoryRevaluationAccountId?: string;
    } | null,
    baseCurrency: string | undefined,
    transaction: unknown
  ): Promise<string | undefined> {
    const addedEntries = Array.from(addedCostByInvAccount.entries()).filter(([, amount]) => Math.abs(amount) > 0.0001);
    const revaluationEntries = Array.from(revaluationByInvAccount.entries()).filter(([, amount]) => Math.abs(amount) > 0.0001);
    if (addedEntries.length === 0 && revaluationEntries.length === 0) return undefined;

    if (addedEntries.length > 0 && !settings?.defaultInventoryTransferClearingAccountId) {
      throw new Error(
        'Added-cost stock transfer cannot post because no Inventory Transfer Clearing account is configured. Set it in Inventory Settings.'
      );
    }
    if (revaluationEntries.length > 0 && !settings?.defaultInventoryRevaluationAccountId) {
      throw new Error(
        'Revaluation stock transfer cannot post because no Inventory Revaluation account is configured. Set defaultInventoryRevaluationAccountId in Inventory Settings.'
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

    let netAddedCost = 0;
    for (const [invAccountId, amount] of addedEntries) {
      const abs = Math.abs(amount);
      netAddedCost = roundMoney(netAddedCost + amount);
      voucherLines.push({
        accountId: invAccountId,
        side: amount > 0 ? 'Debit' : 'Credit',
        amount: abs,
        currency: baseCurrency,
        exchangeRate: 1,
        baseAmount: abs,
        docAmount: abs,
        notes: `Stock transfer ${transfer.id} added cost`,
        metadata: { source: 'stock-transfer', transferId: transfer.id, role: 'inventory-added-cost' },
      });
    }

    const clearingAbs = Math.abs(netAddedCost);
    if (clearingAbs > 0.0001) {
      voucherLines.push({
        accountId: settings!.defaultInventoryTransferClearingAccountId!,
        side: netAddedCost > 0 ? 'Credit' : 'Debit',
        amount: clearingAbs,
        currency: baseCurrency,
        exchangeRate: 1,
        baseAmount: clearingAbs,
        docAmount: clearingAbs,
        notes: `Stock transfer ${transfer.id} clearing`,
        metadata: { source: 'stock-transfer', transferId: transfer.id, role: 'transfer-clearing' },
      });
    }

    let netRevaluation = 0;
    for (const [invAccountId, amount] of revaluationEntries) {
      const abs = Math.abs(amount);
      netRevaluation = roundMoney(netRevaluation + amount);
      voucherLines.push({
        accountId: invAccountId,
        side: amount > 0 ? 'Debit' : 'Credit',
        amount: abs,
        currency: baseCurrency,
        exchangeRate: 1,
        baseAmount: abs,
        docAmount: abs,
        notes: `Stock transfer ${transfer.id} revaluation`,
        metadata: { source: 'stock-transfer', transferId: transfer.id, role: 'inventory-revaluation' },
      });
    }

    const revaluationAbs = Math.abs(netRevaluation);
    if (revaluationAbs > 0.0001) {
      voucherLines.push({
        accountId: settings!.defaultInventoryRevaluationAccountId!,
        side: netRevaluation > 0 ? 'Credit' : 'Debit',
        amount: revaluationAbs,
        currency: baseCurrency,
        exchangeRate: 1,
        baseAmount: revaluationAbs,
        docAmount: revaluationAbs,
        notes: `Stock transfer ${transfer.id} revaluation variance`,
        metadata: { source: 'stock-transfer', transferId: transfer.id, role: 'inventory-revaluation-variance' },
      });
    }

    const voucher = await postFinancialEvent(
      { bridge: this.accountingBridge },
      {
        kind: 'STOCK_TRANSFER',
        transaction,
        subledgerVoucher: {
          companyId,
          voucherType: VoucherType.JOURNAL_ENTRY,
          voucherNo: `TRF-${transfer.id}`,
          date: transfer.date,
          description: `Stock transfer ${transfer.id} valuation entry`,
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
        },
      }
    );

    return voucher ? voucher.id : null;
  }

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    if (!this.companyModuleRepo) return false;
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }
}

export class UndoStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly createUseCase: CreateStockTransferUseCase,
    private readonly completeUseCase: CompleteStockTransferUseCase
  ) {}

  async execute(companyId: string, transferId: string, userId: string, date: string = todayIso()): Promise<StockTransfer> {
    const original = await this.transferRepo.getTransfer(transferId);
    if (!original || original.companyId !== companyId) {
      throw new Error(`Stock transfer not found: ${transferId}`);
    }
    if (original.status !== 'COMPLETED') {
      throw new Error('Only COMPLETED stock transfers can be undone');
    }
    if (original.reversedByTransferId) {
      throw new Error('Stock transfer has already been undone');
    }
    if (original.reversesTransferId) {
      throw new Error('Reversal stock transfers cannot be undone');
    }

    const reverse = await this.createUseCase.execute({
      companyId,
      sourceWarehouseId: original.destinationWarehouseId,
      destinationWarehouseId: original.sourceWarehouseId,
      date,
      notes: `Undo transfer ${original.id}${original.notes ? ` — ${original.notes}` : ''}`,
      mode: original.mode,
      lines: original.lines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        notes: line.notes,
      })),
      createdBy: userId,
    });

    await this.transferRepo.updateTransfer(reverse.id, {
      reversesTransferId: original.id,
    } as Partial<StockTransfer>);

    const completedReverse = await this.completeUseCase.execute(companyId, reverse.id, userId);

    await this.transferRepo.updateTransfer(original.id, {
      reversedByTransferId: completedReverse.id,
    } as Partial<StockTransfer>);

    const updatedReverse = await this.transferRepo.getTransfer(completedReverse.id);
    if (!updatedReverse) {
      throw new Error(`Stock transfer not found after undo: ${completedReverse.id}`);
    }
    return updatedReverse;
  }
}

export class CancelStockTransferUseCase {
  constructor(private readonly transferRepo: IStockTransferRepository) {}

  /**
   * Hard-deletes a DRAFT stock transfer. Safe because a DRAFT has posted no
   * movements and no GL voucher — nothing to reverse. COMPLETED transfers must
   * NOT be deleted here (that would orphan stock movements and any uplift
   * voucher); they require a reversing flow instead.
   */
  async execute(companyId: string, transferId: string): Promise<void> {
    const transfer = await this.transferRepo.getTransfer(transferId);
    if (!transfer || transfer.companyId !== companyId) {
      throw new Error(`Stock transfer not found: ${transferId}`);
    }
    if (transfer.status !== 'DRAFT') {
      throw new Error('Only DRAFT stock transfers can be cancelled');
    }
    await this.transferRepo.deleteTransfer(transferId);
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
