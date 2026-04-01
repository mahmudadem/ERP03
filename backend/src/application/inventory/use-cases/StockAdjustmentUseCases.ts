import { randomUUID } from 'crypto';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { StockAdjustment, StockAdjustmentLine } from '../../../domain/inventory/entities/StockAdjustment';
import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import {
  IAccountRepository,
  ICompanyCurrencyRepository,
  ILedgerRepository,
  IVoucherSequenceRepository,
} from '../../../repository/interfaces/accounting';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockAdjustmentRepository } from '../../../repository/interfaces/inventory/IStockAdjustmentRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { CreateVoucherUseCase } from '../../accounting/use-cases/VoucherUseCases';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { ProcessINInput, ProcessOUTInput, RecordStockMovementUseCase } from './RecordStockMovementUseCase';

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

export interface StockAdjustmentVoucherDependencies {
  voucherRepository: IVoucherRepository;
  accountRepository: IAccountRepository;
  companyModuleSettingsRepository: ICompanyModuleSettingsRepository;
  permissionChecker: PermissionChecker;
  transactionManager: ITransactionManager;
  voucherTypeDefinitionRepository: IVoucherTypeDefinitionRepository;
  accountingPolicyConfigProvider?: IAccountingPolicyConfigProvider;
  ledgerRepository?: ILedgerRepository;
  policyRegistry?: any;
  companyCurrencyRepository?: ICompanyCurrencyRepository;
  voucherSequenceRepository?: IVoucherSequenceRepository;
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
    private readonly voucherDeps?: StockAdjustmentVoucherDependencies
  ) {}

  async execute(companyId: string, adjustmentId: string, userId: string): Promise<StockAdjustment> {
    const adjustment = await this.adjustmentRepo.getAdjustment(adjustmentId);
    if (!adjustment || adjustment.companyId !== companyId) {
      throw new Error(`Stock adjustment not found: ${adjustmentId}`);
    }

    if (adjustment.status !== 'DRAFT') {
      throw new Error('Only DRAFT adjustments can be posted');
    }

    const itemCache = new Map<string, any>();

    for (const line of adjustment.lines) {
      if (line.adjustmentQty === 0) continue;

      const item = await this.itemRepo.getItem(line.itemId);
      if (!item || item.companyId !== companyId) {
        throw new Error(`Item not found for adjustment line: ${line.itemId}`);
      }
      itemCache.set(line.itemId, item);

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
        };

        await this.movementUseCase.processOUT(outInput);
      }
    }

    const voucherId = await this.createVoucherForAdjustment(companyId, userId, adjustment, itemCache);

    const updatePatch: Partial<StockAdjustment> = {
      status: 'POSTED',
      postedAt: new Date(),
    };

    if (voucherId) {
      updatePatch.voucherId = voucherId;
    }

    await this.adjustmentRepo.updateAdjustment(adjustment.id, updatePatch);

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
    itemCache: Map<string, any>
  ): Promise<string | undefined> {
    if (!this.voucherDeps) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Accounting dependencies not provided; skipping GL voucher for adjustment ${adjustment.id}.`
      );
      return undefined;
    }

    const voucherLines: Array<{
      accountId: string;
      side: 'Debit' | 'Credit';
      amount: number;
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
        amount: amountBase,
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
        amount: amountBase,
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

    const expectedAmount = roundMoney(adjustment.adjustmentValueBase);
    if (Math.abs(computedAmountBase - expectedAmount) > 0.01) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Adjustment amount mismatch for ${adjustment.id}: expected=${expectedAmount}, computed=${computedAmountBase}.`
      );
    }

    const createVoucherUseCase = new CreateVoucherUseCase(
      this.voucherDeps.voucherRepository,
      this.voucherDeps.accountRepository,
      this.voucherDeps.companyModuleSettingsRepository,
      this.voucherDeps.permissionChecker,
      this.voucherDeps.transactionManager,
      this.voucherDeps.voucherTypeDefinitionRepository,
      this.voucherDeps.accountingPolicyConfigProvider,
      this.voucherDeps.ledgerRepository,
      this.voucherDeps.policyRegistry,
      this.voucherDeps.companyCurrencyRepository,
      this.voucherDeps.voucherSequenceRepository
    );

    try {
      const voucher = await createVoucherUseCase.execute(companyId, userId, {
        type: 'JV',
        date: adjustment.date,
        description: `Inventory adjustment ${adjustment.id} (${adjustment.reason})`,
        sourceModule: 'inventory',
        reference: {
          type: 'STOCK_ADJUSTMENT',
          id: adjustment.id,
        },
        metadata: {
          sourceModule: 'inventory',
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adjustment.id,
          adjustmentId: adjustment.id,
          adjustmentReason: adjustment.reason,
          adjustmentValueBase: expectedAmount,
        },
        lines: voucherLines,
      });

      return voucher.id;
    } catch (error) {
      console.warn(
        `[Inventory][PostStockAdjustmentUseCase] Failed to create GL voucher for adjustment ${adjustment.id}:`,
        error
      );
      return undefined;
    }
  }
}
