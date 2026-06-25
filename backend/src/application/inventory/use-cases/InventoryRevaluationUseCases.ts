import { randomUUID } from 'crypto';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { roundByCurrency } from '../../../domain/accounting/entities/CurrencyPrecisionHelpers';
import {
  InventoryRevaluation,
  InventoryRevaluationLine,
  InventoryRevaluationReason,
} from '../../../domain/inventory/entities/InventoryRevaluation';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventoryRevaluationRepository } from '../../../repository/interfaces/inventory/IInventoryRevaluationRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { postFinancialEvent } from '../../accounting/services/postFinancialEvent';
import { IAccountingBridge } from '../../system-core/contracts/IAccountingBridge';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { Item, ItemCostingStats, CostPoint } from '../../../domain/inventory/entities/Item';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';
import { buildAverageCostPoint } from '../../inventory/services/ItemCostingStatsService';

export interface CreateInventoryRevaluationInput {
  companyId: string;
  date: string;
  reason: InventoryRevaluationReason;
  notes?: string;
  lines: Array<{
    itemId: string;
    warehouseId?: string;
    qtyOnHand?: number;
    currentAvgCostBase?: number;
    currentAvgCostCCY?: number;
    newAvgCostBase: number;
    newAvgCostCCY: number;
    reason?: string;
  }>;
  createdBy: string;
}

export interface ListInventoryRevaluationsInput {
  status?: 'DRAFT' | 'POSTED';
  limit?: number;
  offset?: number;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const round6 = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

/**
 * Build a draft Inventory Revaluation. The use case re-reads the authoritative
 * current quantity / average cost from the sub-ledger for every line so the
 * draft value-deltas are sourced from real on-hand data, not stale user input.
 *
 * For PERIODIC companies the revaluation is still useful — it snapshots a new
 * carrying cost on the item/level so the report-time Inventory Valuation
 * service picks it up. The actual GL posting is decided at `post()` time.
 */
export class CreateInventoryRevaluationUseCase {
  constructor(
    private readonly revaluationRepo: IInventoryRevaluationRepository,
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository
  ) {}

  async execute(input: CreateInventoryRevaluationInput): Promise<InventoryRevaluation> {
    if (!input.lines.length) {
      throw new Error('At least one line is required for an inventory revaluation.');
    }

    const settings = await this.inventorySettingsRepo.getSettings(input.companyId);
    const costingBasis: 'WAREHOUSE' | 'GLOBAL' =
      settings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';

    const lines: InventoryRevaluationLine[] = [];
    for (const raw of input.lines) {
      const item = await this.itemRepo.getItem(raw.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${raw.itemId}`);
      }
      if (costingBasis === 'GLOBAL' && raw.warehouseId) {
        throw new Error(
          `Costing basis is GLOBAL: do not specify a warehouseId on the revaluation line for item ${item.code || item.id}.`
        );
      }

      const snapshot = await this.resolveLevelSnapshot(
        input.companyId,
        item,
        raw.warehouseId,
        costingBasis
      );

      const newAvgCostBase = round2(raw.newAvgCostBase);
      const newAvgCostCCY = round2(raw.newAvgCostCCY);
      if (newAvgCostBase < 0 || newAvgCostCCY < 0) {
        throw new Error(`New average cost must be non-negative for item ${item.code || item.id}.`);
      }

      const valueDeltaBase = round2(snapshot.qtyOnHand * (newAvgCostBase - snapshot.currentAvgCostBase));
      const valueDeltaCCY = round2(snapshot.qtyOnHand * (newAvgCostCCY - snapshot.currentAvgCostCCY));

      lines.push({
        itemId: item.id,
        warehouseId: costingBasis === 'WAREHOUSE' ? raw.warehouseId : undefined,
        qtyOnHand: round6(snapshot.qtyOnHand),
        currentAvgCostBase: round2(snapshot.currentAvgCostBase),
        currentAvgCostCCY: round2(snapshot.currentAvgCostCCY),
        newAvgCostBase,
        newAvgCostCCY,
        valueDeltaBase,
        valueDeltaCCY,
        reason: raw.reason,
      });
    }

    const totalValueDeltaBase = round2(lines.reduce((sum, line) => sum + line.valueDeltaBase, 0));
    const totalValueDeltaCCY = round2(lines.reduce((sum, line) => sum + line.valueDeltaCCY, 0));

    if (Math.abs(totalValueDeltaBase) < 0.005 && Math.abs(totalValueDeltaCCY) < 0.005) {
      throw new Error(
        'All revaluation lines have zero value delta. The new average cost must differ from the current average cost for at least one line.'
      );
    }

    const revaluation = new InventoryRevaluation({
      id: randomUUID(),
      companyId: input.companyId,
      date: input.date,
      reason: input.reason,
      notes: input.notes,
      lines,
      status: 'DRAFT',
      totalValueDeltaBase,
      totalValueDeltaCCY,
      createdBy: input.createdBy,
      createdAt: new Date(),
    });

    await this.revaluationRepo.createRevaluation(revaluation);
    return revaluation;
  }

  private async resolveLevelSnapshot(
    companyId: string,
    item: Item,
    warehouseId: string | undefined,
    costingBasis: 'WAREHOUSE' | 'GLOBAL'
  ): Promise<{ qtyOnHand: number; currentAvgCostBase: number; currentAvgCostCCY: number }> {
    if (costingBasis === 'WAREHOUSE') {
      if (!warehouseId) {
        throw new Error(
          `Costing basis is WAREHOUSE: warehouseId is required for the revaluation line of item ${item.code || item.id}.`
        );
      }
      const level = await this.stockLevelRepo.getLevel(companyId, item.id, warehouseId);
      if (!level) {
        return { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
      }
      return {
        qtyOnHand: level.qtyOnHand,
        currentAvgCostBase: level.avgCostBase,
        currentAvgCostCCY: level.avgCostCCY,
      };
    }

    const levels = await this.stockLevelRepo.getLevelsByItem(companyId, item.id);
    if (!levels.length) {
      return { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
    }
    let totalQty = 0;
    let totalValueBase = 0;
    let totalValueCCY = 0;
    for (const lvl of levels) {
      totalQty += lvl.qtyOnHand;
      totalValueBase += lvl.qtyOnHand * lvl.avgCostBase;
      totalValueCCY += lvl.qtyOnHand * lvl.avgCostCCY;
    }
    if (totalQty <= 0) {
      return { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
    }
    return {
      qtyOnHand: totalQty,
      currentAvgCostBase: totalValueBase / totalQty,
      currentAvgCostCCY: totalValueCCY / totalQty,
    };
  }
}

/**
 * Post a DRAFT Inventory Revaluation. Behavior is mode-aware:
 *
 *   - INVOICE_DRIVEN / PERPETUAL: open one Firestore transaction that
 *     (a) re-snapshots each level, (b) writes the new avg cost to the
 *     target stock level(s) and the item's costing stats, and
 *     (c) records a balanced JOURNAL_ENTRY financial event through
 *     IAccountingBridge — Dr/Cr Inventory Asset vs the
     *     dedicated Inventory Revaluation account. Period lock + approval
     *     remain enforced by the Accounting Engine behind the bridge.
 *
 *   - PERIODIC: same in-transaction revaluation of the sub-ledger
 *     average cost (so the report-time Inventory Valuation reflects
 *     the new basis), but NO Inventory Asset GL voucher is posted.
 *     The revaluation document is the auditable artifact.
 */
export class PostInventoryRevaluationUseCase {
  constructor(
    private readonly revaluationRepo: IInventoryRevaluationRepository,
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingBridge: IAccountingBridge
  ) {}

  async execute(companyId: string, revaluationId: string, userId: string): Promise<InventoryRevaluation> {
    const revaluation = await this.revaluationRepo.getRevaluation(companyId, revaluationId);
    if (!revaluation || revaluation.companyId !== companyId) {
      throw new Error(`Inventory revaluation not found: ${revaluationId}`);
    }
    if (revaluation.status !== 'DRAFT') {
      throw new Error('Only DRAFT inventory revaluations can be posted.');
    }

    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    const accountingEnabled = !!accountingModule?.initialized;

    const settings = this.inventorySettingsRepo
      ? await this.inventorySettingsRepo.getSettings(companyId)
      : null;
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(settings);
    const shouldPostAccounting = accountingEnabled && accountingMode !== 'PERIODIC';

    if (
      shouldPostAccounting
      && !settings?.defaultInventoryRevaluationAccountId
    ) {
      throw new Error(
        'Inventory revaluation cannot be posted because no Inventory Revaluation / Variance account is configured. Set the default Inventory Revaluation account in Inventory Settings.'
      );
    }

    let voucherId: string | undefined;
    await this.transactionManager.runTransaction(async (transaction) => {
      const recomputedLines: InventoryRevaluationLine[] = [];
      const costingBasis: 'WAREHOUSE' | 'GLOBAL' =
        settings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';

      for (const line of revaluation.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }

        const snapshot = await this.resolveLevelSnapshotInTransaction(
          transaction,
          companyId,
          item,
          line.warehouseId,
          costingBasis
        );

        if (snapshot.qtyOnHand === 0) {
          throw new Error(
            `Inventory revaluation cannot be posted because item ${item.code || item.id} has zero on-hand quantity. Post a Stock Adjustment or receive stock first.`
          );
        }

        const newAvgCostBase = line.newAvgCostBase;
        const newAvgCostCCY = line.newAvgCostCCY;

        const valueDeltaBase = round2(snapshot.qtyOnHand * (newAvgCostBase - snapshot.currentAvgCostBase));
        const valueDeltaCCY = round2(snapshot.qtyOnHand * (newAvgCostCCY - snapshot.currentAvgCostCCY));

        recomputedLines.push({
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          qtyOnHand: round6(snapshot.qtyOnHand),
          currentAvgCostBase: round2(snapshot.currentAvgCostBase),
          currentAvgCostCCY: round2(snapshot.currentAvgCostCCY),
          newAvgCostBase,
          newAvgCostCCY,
          valueDeltaBase,
          valueDeltaCCY,
          reason: line.reason,
        });

        await this.applyLevelWriteInTransaction(
          transaction,
          companyId,
          item,
          revaluation.id,
          revaluation.date,
          line,
          newAvgCostBase,
          newAvgCostCCY,
          settings?.defaultCostCurrency || item.costCurrency,
          costingBasis
        );
      }

      const totalValueDeltaBase = round2(
        recomputedLines.reduce((sum, line) => sum + line.valueDeltaBase, 0)
      );
      const totalValueDeltaCCY = round2(
        recomputedLines.reduce((sum, line) => sum + line.valueDeltaCCY, 0)
      );

      if (shouldPostAccounting && settings) {
        voucherId = await this.createVoucherForRevaluation(
          companyId,
          userId,
          revaluation,
          recomputedLines,
          settings,
          transaction
        );
      }

      await this.revaluationRepo.updateRevaluation(
        companyId,
        revaluation.id,
        {
          lines: recomputedLines,
          totalValueDeltaBase,
          totalValueDeltaCCY,
          status: 'POSTED',
          voucherId: voucherId || null,
          postedAt: new Date(),
        },
        transaction
      );
    });

    const posted = await this.revaluationRepo.getRevaluation(companyId, revaluation.id);
    if (!posted) {
      throw new Error(`Inventory revaluation disappeared after posting: ${revaluationId}`);
    }
    return posted;
  }

  private async createVoucherForRevaluation(
    companyId: string,
    userId: string,
    revaluation: InventoryRevaluation,
    recomputedLines: InventoryRevaluationLine[],
    settings: InventorySettings,
    transaction: unknown
  ): Promise<string> {
    const revaluationAccountId = settings.defaultInventoryRevaluationAccountId;
    if (!revaluationAccountId) {
      throw new Error(
        'Inventory revaluation cannot be posted because no Inventory Revaluation / Variance account is configured.'
      );
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

    let computedAmountBase = 0;

    for (const line of recomputedLines) {
      const item = await this.itemRepo.getItem(line.itemId);
      if (!item || item.companyId !== companyId) {
        throw new Error(`Item not found at voucher time: ${line.itemId}`);
      }
      const amountBase = roundMoney(Math.abs(line.valueDeltaBase));
      if (amountBase <= 0) continue;

      const assetAccountId = item.inventoryAssetAccountId || settings.defaultInventoryAssetAccountId;
      if (!assetAccountId) {
        throw new Error(
          `Inventory revaluation cannot be posted because item ${item.code || item.id} has no Inventory Asset account. Set it on the item's Accounting GL tab or set a default Inventory Asset account in Inventory Settings.`
        );
      }

      const isWriteUp = line.valueDeltaBase > 0;
      const debitAccountId = isWriteUp ? assetAccountId : revaluationAccountId;
      const creditAccountId = isWriteUp ? revaluationAccountId : assetAccountId;

      const lineMeta = {
        source: 'inventory-revaluation',
        revaluationId: revaluation.id,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        direction: isWriteUp ? 'WRITE_UP' : 'WRITE_DOWN',
        currentAvgCostBase: line.currentAvgCostBase,
        newAvgCostBase: line.newAvgCostBase,
        qtyOnHand: line.qtyOnHand,
      };

      voucherLines.push({
        accountId: debitAccountId,
        side: 'Debit',
        amount: amountBase,
        currency: '',
        exchangeRate: 1,
        baseAmount: amountBase,
        docAmount: amountBase,
        notes: `Inventory revaluation ${revaluation.id} (${item.code || item.id})`,
        metadata: lineMeta,
      });
      voucherLines.push({
        accountId: creditAccountId,
        side: 'Credit',
        amount: amountBase,
        currency: '',
        exchangeRate: 1,
        baseAmount: amountBase,
        docAmount: amountBase,
        notes: `Inventory revaluation ${revaluation.id} (${item.code || item.id})`,
        metadata: lineMeta,
      });

      computedAmountBase = roundMoney(computedAmountBase + amountBase);
    }

    if (voucherLines.length === 0) {
      throw new Error(
        `Inventory revaluation ${revaluation.id} has no positive value deltas; refusing to post a zero-amount voucher.`
      );
    }

    try {
      const voucher = await postFinancialEvent(
        { bridge: this.accountingBridge },
        {
          kind: 'INVENTORY_REVALUATION',
          transaction,
          subledgerVoucher: {
            companyId,
            voucherType: VoucherType.JOURNAL_ENTRY,
            voucherNo: `REV-${revaluation.id}`,
            date: revaluation.date,
            description: `Inventory revaluation ${revaluation.id} (${revaluation.reason})`,
            currency: '',
            exchangeRate: 1,
            lines: voucherLines,
            metadata: {
              sourceModule: 'inventory',
              referenceType: 'INVENTORY_REVALUATION',
              referenceId: revaluation.id,
              revaluationId: revaluation.id,
              revaluationReason: revaluation.reason,
              totalValueDeltaBase: computedAmountBase,
            },
            createdBy: userId,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: revaluation.id,
          },
        }
      );

      return voucher ? voucher.id : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[Inventory][PostInventoryRevaluationUseCase] Failed to create GL voucher for revaluation ${revaluation.id}: ${message}`
      );
    }
  }

  private async applyLevelWriteInTransaction(
    transaction: unknown,
    companyId: string,
    item: Item,
    revaluationId: string,
    revaluationDate: string,
    line: InventoryRevaluationLine,
    newAvgCostBase: number,
    newAvgCostCCY: number,
    baseCurrency: string,
    costingBasis: 'WAREHOUSE' | 'GLOBAL'
  ): Promise<void> {
    const levels = await this.stockLevelRepo.getLevelsByItemInTransaction(transaction, companyId, item.id);
    if (!levels.length) {
      return;
    }

    const totalQty = levels.reduce((sum, lvl) => sum + lvl.qtyOnHand, 0);
    const now = new Date();
    const precisionCurrency = item.costCurrency;

    for (const lvl of levels) {
      if (lvl.qtyOnHand <= 0) continue;
      const isTargetWarehouse = !!line.warehouseId && lvl.warehouseId === line.warehouseId;
      if (line.warehouseId && !isTargetWarehouse) continue;
      // WAREHOUSE costing revalues only the named warehouse. GLOBAL costing
      // revalues every level so the company-wide average stays consistent.
      if (costingBasis === 'WAREHOUSE' && line.warehouseId && !isTargetWarehouse) continue;

      lvl.avgCostBase = roundByCurrency(newAvgCostBase, precisionCurrency);
      lvl.avgCostCCY = roundByCurrency(newAvgCostCCY, precisionCurrency);
      lvl.lastCostBase = roundByCurrency(newAvgCostBase, precisionCurrency);
      lvl.lastCostCCY = roundByCurrency(newAvgCostCCY, precisionCurrency);

      lvl.version += 1;
      lvl.updatedAt = now;
      await this.stockLevelRepo.upsertLevelInTransaction(transaction, lvl);
    }

    const updatedLevels = levels.map((lvl) => ({ ...lvl }));
    const itemStats = item.costingStats;
    if (itemStats) {
      const newCostPoint: CostPoint = buildAverageCostPoint(
        updatedLevels as any,
        item,
        baseCurrency,
        costingBasis,
        itemStats.avgCost
      );
      newCostPoint.asOf = revaluationDate;
      newCostPoint.qty = totalQty;
      newCostPoint.source = {
        refType: 'INVENTORY_REVALUATION',
        refId: revaluationId,
        docType: 'INVENTORY_REVALUATION',
        docId: revaluationId,
        docNo: revaluationId,
        lineId: revaluationRefIdFromLevel(line, costingBasis),
      };
      const nextStats: ItemCostingStats = {
        ...itemStats,
        avgCost: newCostPoint,
      };
      await this.itemRepo.updateItemInTransaction(
        companyId,
        item.id,
        { costingStats: nextStats, updatedAt: now } as Partial<Item>,
        transaction
      );
    }
  }

  private async resolveLevelSnapshotInTransaction(
    transaction: unknown,
    companyId: string,
    item: Item,
    warehouseId: string | undefined,
    costingBasis: 'WAREHOUSE' | 'GLOBAL'
  ): Promise<{ qtyOnHand: number; currentAvgCostBase: number; currentAvgCostCCY: number }> {
    if (costingBasis === 'WAREHOUSE') {
      if (!warehouseId) {
        throw new Error(
          `Costing basis is WAREHOUSE: warehouseId is required for revaluation line of item ${item.code || item.id}.`
        );
      }
      const level = await this.stockLevelRepo.getLevelInTransaction(
        transaction,
        companyId,
        item.id,
        warehouseId
      );
      if (!level) {
        return { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
      }
      return {
        qtyOnHand: level.qtyOnHand,
        currentAvgCostBase: level.avgCostBase,
        currentAvgCostCCY: level.avgCostCCY,
      };
    }
    const levels = await this.stockLevelRepo.getLevelsByItemInTransaction(transaction, companyId, item.id);
    if (!levels.length) {
      return { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
    }
    let totalQty = 0;
    let totalValueBase = 0;
    let totalValueCCY = 0;
    for (const lvl of levels) {
      totalQty += lvl.qtyOnHand;
      totalValueBase += lvl.qtyOnHand * lvl.avgCostBase;
      totalValueCCY += lvl.qtyOnHand * lvl.avgCostCCY;
    }
    if (totalQty <= 0) {
      return { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
    }
    return {
      qtyOnHand: totalQty,
      currentAvgCostBase: totalValueBase / totalQty,
      currentAvgCostCCY: totalValueCCY / totalQty,
    };
  }
}

const revaluationRefIdFromLevel = (
  line: InventoryRevaluationLine,
  costingBasis: 'WAREHOUSE' | 'GLOBAL'
): string => {
  if (costingBasis === 'GLOBAL') return 'GLOBAL';
  return line.warehouseId || 'GLOBAL';
};

export class ListInventoryRevaluationsUseCase {
  constructor(private readonly revaluationRepo: IInventoryRevaluationRepository) {}

  async execute(companyId: string, opts: ListInventoryRevaluationsInput = {}): Promise<InventoryRevaluation[]> {
    if (opts.status) {
      return this.revaluationRepo.getByStatus(companyId, opts.status, {
        limit: opts.limit,
        offset: opts.offset,
      });
    }
    return this.revaluationRepo.getCompanyRevaluations(companyId, {
      limit: opts.limit,
      offset: opts.offset,
    });
  }
}

export class GetInventoryRevaluationUseCase {
  constructor(private readonly revaluationRepo: IInventoryRevaluationRepository) {}

  async execute(companyId: string, id: string): Promise<InventoryRevaluation | null> {
    return this.revaluationRepo.getRevaluation(companyId, id);
  }
}
