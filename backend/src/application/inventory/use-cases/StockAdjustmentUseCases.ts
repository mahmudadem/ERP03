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
    private readonly accountingPostingService?: SubledgerVoucherPostingService
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

    await this.transactionManager.runTransaction(async (transaction) => {
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

          await this.movementUseCase.processIN(inInput);
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

          await this.movementUseCase.processOUT(outInput);
        }
      }

      let voucherId: string | undefined;
      if (shouldPostAccounting && this.accountingPostingService) {
        voucherId = await this.createVoucherForAdjustment(
          companyId,
          userId,
          adjustment,
          itemCache,
          Array.from(baseCurrencyCache.values())[0],
          transaction
        );
      }

      const updatePatch: Partial<StockAdjustment> = {
        status: 'POSTED',
        postedAt: new Date(),
        voucherId: voucherId || null,
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
    baseCurrencyOverride?: string,
    transaction?: unknown
  ): Promise<string | undefined> {
    if (!this.accountingPostingService) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Accounting dependencies not provided; skipping GL voucher for adjustment ${adjustment.id}.`
      );
      return undefined;
    }

    const voucherLines: Array<{
      accountId: string;
      side: 'Debit' | 'Credit';
      baseAmount: number;
      docAmount: number;
      notes: string;
      metadata: Record<string, any>;
    }> = [];

    let computedAmountBase = 0;

    for (const line of adjustment.lines) {
      if (line.adjustmentQty === 0) continue;

      const item = itemCache.get(line.itemId) || (await this.itemRepo.getItem(line.itemId));
      if (!item || item.companyId !== companyId) {
        console.warn(
          `[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: item not found (${line.itemId}).`
        );
        return undefined;
      }

      if (!item.inventoryAssetAccountId || !item.cogsAccountId) {
        console.warn(
          `[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: item ${item.id} is missing inventoryAssetAccountId or cogsAccountId.`
        );
        return undefined;
      }

      const amountBase = roundMoney(Math.abs(line.adjustmentQty) * line.unitCostBase);
      if (amountBase <= 0) continue;

      computedAmountBase = roundMoney(computedAmountBase + amountBase);

      const isAdjustmentOut = line.adjustmentQty < 0;
      const debitAccountId = isAdjustmentOut ? item.cogsAccountId : item.inventoryAssetAccountId;
      const creditAccountId = isAdjustmentOut ? item.inventoryAssetAccountId : item.cogsAccountId;

      voucherLines.push({
        accountId: debitAccountId,
        side: 'Debit',
        baseAmount: amountBase,
        docAmount: amountBase,
        notes: `Stock adjustment ${adjustment.id} (${line.itemId})`,
        metadata: {
          source: 'inventory-adjustment',
          adjustmentId: adjustment.id,
          itemId: line.itemId,
          warehouseId: adjustment.warehouseId,
          direction: isAdjustmentOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
        },
      });

      voucherLines.push({
        accountId: creditAccountId,
        side: 'Credit',
        baseAmount: amountBase,
        docAmount: amountBase,
        notes: `Stock adjustment ${adjustment.id} (${line.itemId})`,
        metadata: {
          source: 'inventory-adjustment',
          adjustmentId: adjustment.id,
          itemId: line.itemId,
          warehouseId: adjustment.warehouseId,
          direction: isAdjustmentOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
        },
      });
    }

    if (voucherLines.length === 0) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: no monetary adjustment lines.`
      );
      return undefined;
    }

    if (!baseCurrencyOverride) {
      throw new Error(
        `[Inventory][PostStockAdjustmentUseCase] Missing base currency for adjustment ${adjustment.id}.`
      );
    }

    const expectedAmount = roundMoney(adjustment.adjustmentValueBase);
    if (Math.abs(computedAmountBase - expectedAmount) > 0.01) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Adjustment amount mismatch for ${adjustment.id}: expected=${expectedAmount}, computed=${computedAmountBase}.`
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
          adjustmentValueBase: expectedAmount,
        },
        createdBy: userId,
        postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
        reference: adjustment.id,
        baseCurrencyOverride,
        skipAccountValidation: true,
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
