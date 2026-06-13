import { randomUUID } from 'crypto';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { StockAdjustment, StockAdjustmentLine } from '../../../domain/inventory/entities/StockAdjustment';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockAdjustmentRepository } from '../../../repository/interfaces/inventory/IStockAdjustmentRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { ProcessINInput, ProcessOUTInput, RecordStockMovementUseCase } from './RecordStockMovementUseCase';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';

export interface CreateStockAdjustmentInput {
  companyId: string;
  warehouseId: string;
  date: string;
  reason: StockAdjustment['reason'];
  notes?: string;
  lines: Array<{
    itemId: string;
    currentQty: number;
    newQty: number;
    unitCostBase: number;
    unitCostCCY: number;
  }>;
  createdBy: string;
}

export class CreateStockAdjustmentUseCase {
  constructor(private readonly adjustmentRepo: IStockAdjustmentRepository) {}

  async execute(input: CreateStockAdjustmentInput): Promise<StockAdjustment> {
    const lines: StockAdjustmentLine[] = input.lines.map((line) => ({
      itemId: line.itemId,
      currentQty: line.currentQty,
      newQty: line.newQty,
      adjustmentQty: line.newQty - line.currentQty,
      unitCostBase: line.unitCostBase,
      unitCostCCY: line.unitCostCCY,
    }));

    const adjustmentValueBase = roundMoney(
      lines.reduce(
        (sum, line) => sum + Math.abs(line.adjustmentQty) * line.unitCostBase,
        0
      )
    );

    const adjustment = new StockAdjustment({
      id: randomUUID(),
      companyId: input.companyId,
      warehouseId: input.warehouseId,
      date: input.date,
      reason: input.reason,
      notes: input.notes,
      lines,
      status: 'DRAFT',
      adjustmentValueBase,
      createdBy: input.createdBy,
      createdAt: new Date(),
    });

    await this.adjustmentRepo.createAdjustment(adjustment);
    return adjustment;
  }
}

export class PostStockAdjustmentUseCase {
  constructor(
    private readonly adjustmentRepo: IStockAdjustmentRepository,
    private readonly itemRepo: IItemRepository,
    private readonly movementUseCase: RecordStockMovementUseCase,
    private readonly transactionManager: ITransactionManager,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService?: SubledgerVoucherPostingService,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(companyId: string, adjustmentId: string, userId: string, createAccountingEffect: boolean = true): Promise<StockAdjustment> {
    const adjustment = await this.adjustmentRepo.getAdjustment(adjustmentId);
    if (!adjustment || adjustment.companyId !== companyId) {
      throw new Error(`Stock adjustment not found: ${adjustmentId}`);
    }

    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);

    if (adjustment.status !== 'DRAFT') {
      throw new Error('Only DRAFT adjustments can be posted');
    }

    const itemCache = new Map<string, any>();
    const baseCurrencyCache = new Map<string, string>();
    const levelCache = new Map<string, StockLevel>();
    for (const line of adjustment.lines) {
      if (line.adjustmentQty === 0) continue;
      const { item, baseCurrency } = await this.movementUseCase.preFetchItemContext(companyId, line.itemId);
      if (!item || item.companyId !== companyId) {
        throw new Error(`Item not found for adjustment line: ${line.itemId}`);
      }
      itemCache.set(line.itemId, item);
      baseCurrencyCache.set(line.itemId, baseCurrency);
      const level = await this.movementUseCase.preFetchStockLevel(
        companyId,
        line.itemId,
        adjustment.warehouseId
      );
      levelCache.set(
        line.itemId,
        level ?? StockLevel.createNew(companyId, line.itemId, adjustment.warehouseId)
      );
    }

    // Resolve dedicated inventory gain/loss + asset fallbacks once per post.
    const settings = shouldPostAccounting && this.inventorySettingsRepo
      ? await this.inventorySettingsRepo.getSettings(companyId)
      : null;

    await this.transactionManager.runTransaction(async (transaction) => {
      // Capture the ACTUAL posted movements so the GL voucher is valued from the
      // engine's real cost (avg cost for OUT, applied cost for IN) — never from
      // the user-typed unit cost, which can silently diverge from the subledger.
      const lineMovements: Array<{ line: StockAdjustmentLine; movement: StockMovement }> = [];

      for (const line of adjustment.lines) {
        if (line.adjustmentQty === 0) continue;
        const item = itemCache.get(line.itemId);

        if (line.adjustmentQty > 0) {
          const fxRate = line.unitCostCCY > 0 ? line.unitCostBase / line.unitCostCCY : 1;
          const inInput: ProcessINInput = {
            companyId,
            itemId: line.itemId,
            warehouseId: adjustment.warehouseId,
            qty: line.adjustmentQty,
            date: adjustment.date,
            movementType: 'ADJUSTMENT_IN',
            refs: {
              type: 'STOCK_ADJUSTMENT',
              docId: adjustment.id,
            },
            currentUser: userId,
            notes: adjustment.notes,
            unitCostInMoveCurrency: line.unitCostCCY,
            moveCurrency: item.costCurrency,
            fxRateMovToBase: fxRate,
            fxRateCCYToBase: fxRate,
            transaction,
            preFetchedItem: item,
            baseCurrency: baseCurrencyCache.get(line.itemId),
            preFetchedLevel: levelCache.get(line.itemId),
            skipWarehouseValidation: true,
          };

          const movement = await this.movementUseCase.processIN(inInput);
          lineMovements.push({ line, movement });
        } else {
          const outInput: ProcessOUTInput = {
            companyId,
            itemId: line.itemId,
            warehouseId: adjustment.warehouseId,
            qty: Math.abs(line.adjustmentQty),
            date: adjustment.date,
            movementType: 'ADJUSTMENT_OUT',
            refs: {
              type: 'STOCK_ADJUSTMENT',
              docId: adjustment.id,
            },
            currentUser: userId,
            notes: adjustment.notes,
            transaction,
            preFetchedItem: item,
            preFetchedLevel: levelCache.get(line.itemId),
            skipWarehouseValidation: true,
          };

          const movement = await this.movementUseCase.processOUT(outInput);
          lineMovements.push({ line, movement });
        }
      }

      // Real posted value = sum of the actual movement totals (base currency).
      const realValueBase = roundMoney(
        lineMovements.reduce((sum, { movement }) => sum + Math.abs(movement.totalCostBase), 0)
      );

      let voucherId: string | undefined;
      if (shouldPostAccounting && this.accountingPostingService) {
        voucherId = await this.createVoucherForAdjustment(
          companyId,
          userId,
          adjustment,
          itemCache,
          lineMovements,
          settings,
          Array.from(baseCurrencyCache.values())[0],
          transaction
        );
      }

      const updatePatch: Partial<StockAdjustment> = {
        status: 'POSTED',
        postedAt: new Date(),
        voucherId: voucherId || null,
        adjustmentValueBase: realValueBase,
      };

      await this.adjustmentRepo.updateAdjustment(companyId, adjustment.id, updatePatch, transaction);
    });

    const posted = await this.adjustmentRepo.getAdjustment(adjustment.id);
    if (!posted) {
      throw new Error(`Stock adjustment not found after posting: ${adjustment.id}`);
    }

    return posted;
  }

  private async createVoucherForAdjustment(
    companyId: string,
    userId: string,
    adjustment: StockAdjustment,
    itemCache: Map<string, any>,
    lineMovements: Array<{ line: StockAdjustmentLine; movement: StockMovement }>,
    settings: InventorySettings | null,
    baseCurrencyOverride?: string,
    transaction?: unknown
  ): Promise<string | undefined> {
    if (!this.accountingPostingService) {
      throw new Error(
        'Inventory adjustment cannot be posted because accounting posting is not configured.'
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

    for (const { line, movement } of lineMovements) {
      if (line.adjustmentQty === 0) continue;

      const item = itemCache.get(line.itemId) || (await this.itemRepo.getItem(line.itemId));
      if (!item || item.companyId !== companyId) {
        throw new Error(
          `Inventory adjustment cannot be posted because item ${line.itemId} was not found.`
        );
      }

      // F1: value the GL from the actual posted movement, not the typed cost.
      const amountBase = roundMoney(Math.abs(movement.totalCostBase));
      if (amountBase <= 0) continue;
      if (!baseCurrencyOverride) {
        throw new Error(
          `[Inventory][PostStockAdjustmentUseCase] Missing base currency for adjustment ${adjustment.id}.`
        );
      }

      const isAdjustmentOut = line.adjustmentQty < 0;

      // Inventory asset side: item -> inventory settings default.
      const assetAccountId = item.inventoryAssetAccountId || settings?.defaultInventoryAssetAccountId;
      // Offset side: dedicated gain/loss -> item COGS -> settings COGS (graceful fallback).
      const offsetAccountId = isAdjustmentOut
        ? (settings?.defaultInventoryLossAccountId || item.cogsAccountId || settings?.defaultCOGSAccountId)
        : (settings?.defaultInventoryGainAccountId || item.cogsAccountId || settings?.defaultCOGSAccountId);

      if (!assetAccountId) {
        throw new Error(
          `Inventory adjustment cannot be posted because item ${item.code || item.id} has no Inventory Asset account. Set it on the item's Accounting GL tab or set a default Inventory Asset account in Inventory Settings.`
        );
      }
      if (!offsetAccountId) {
        throw new Error(
          `Inventory adjustment cannot be posted because no offset account is configured for ${isAdjustmentOut ? 'stock losses (write-downs)' : 'stock gains (write-ups)'}. Set the ${isAdjustmentOut ? 'Inventory Loss' : 'Inventory Gain'} account in Inventory Settings (or a COGS account on the item).`
        );
      }

      computedAmountBase = roundMoney(computedAmountBase + amountBase);

      // OUT (loss): Dr loss / Cr inventory asset. IN (gain): Dr inventory asset / Cr gain.
      const debitAccountId = isAdjustmentOut ? offsetAccountId : assetAccountId;
      const creditAccountId = isAdjustmentOut ? assetAccountId : offsetAccountId;

      const lineMeta = {
        source: 'inventory-adjustment',
        adjustmentId: adjustment.id,
        itemId: line.itemId,
        warehouseId: adjustment.warehouseId,
        movementId: movement.id,
        direction: isAdjustmentOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
      };

      voucherLines.push({
        accountId: debitAccountId,
        side: 'Debit',
        amount: amountBase,
        currency: baseCurrencyOverride,
        exchangeRate: 1,
        baseAmount: amountBase,
        docAmount: amountBase,
        notes: `Stock adjustment ${adjustment.id} (${line.itemId})`,
        metadata: lineMeta,
      });

      voucherLines.push({
        accountId: creditAccountId,
        side: 'Credit',
        amount: amountBase,
        currency: baseCurrencyOverride,
        exchangeRate: 1,
        baseAmount: amountBase,
        docAmount: amountBase,
        notes: `Stock adjustment ${adjustment.id} (${line.itemId})`,
        metadata: lineMeta,
      });
    }

    if (voucherLines.length === 0) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: all adjustment lines have zero value.`
      );
      return undefined;
    }

    if (!baseCurrencyOverride) {
      throw new Error(
        `[Inventory][PostStockAdjustmentUseCase] Missing base currency for adjustment ${adjustment.id}.`
      );
    }

    try {
      const voucher = await this.accountingPostingService.postInTransaction({
        companyId,
        voucherType: VoucherType.JOURNAL_ENTRY,
        voucherNo: `ADJ-${adjustment.id}`,
        date: adjustment.date,
        description: `Inventory adjustment ${adjustment.id} (${adjustment.reason})`,
        currency: '',
        exchangeRate: 1,
        lines: voucherLines,
        metadata: {
          sourceModule: 'inventory',
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adjustment.id,
          adjustmentId: adjustment.id,
          adjustmentReason: adjustment.reason,
          adjustmentValueBase: computedAmountBase,
        },
        createdBy: userId,
        postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
        reference: adjustment.id,
        baseCurrencyOverride,
      }, transaction);

      return voucher.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[Inventory][PostStockAdjustmentUseCase] Failed to create GL voucher for adjustment ${adjustment.id}: ${message}`
      );
    }
  }

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }
}
