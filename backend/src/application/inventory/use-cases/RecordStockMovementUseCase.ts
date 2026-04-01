import { randomUUID } from 'crypto';
import { roundByCurrency } from '../../../domain/accounting/entities/CurrencyPrecisionHelpers';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { Item } from '../../../domain/inventory/entities/Item';
import {
  CostSource,
  MovementType,
  ReferenceType,
  StockMovement,
} from '../../../domain/inventory/entities/StockMovement';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';

interface MovementRefs {
  type: ReferenceType;
  docId?: string;
  lineId?: string;
  reversesMovementId?: string;
  transferPairId?: string;
}

interface BaseMovementInput {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qty: number;
  date: string;
  movementType: MovementType;
  refs: MovementRefs;
  currentUser: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ProcessINInput extends BaseMovementInput {
  unitCostInMoveCurrency: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
}

export interface ProcessOUTInput extends BaseMovementInput {
  forcedUnitCostBase?: number;
  forcedUnitCostCCY?: number;
}

export interface ProcessTRANSFERInput {
  companyId: string;
  itemId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  qty: number;
  date: string;
  transferDocId: string;
  transferPairId?: string;
  transaction?: unknown;
  currentUser: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface TransferResult {
  outMov: StockMovement;
  inMov: StockMovement;
}

interface UseCaseDependencies {
  itemRepository: IItemRepository;
  warehouseRepository: IWarehouseRepository;
  stockMovementRepository: IStockMovementRepository;
  stockLevelRepository: IStockLevelRepository;
  companyRepository: ICompanyRepository;
  transactionManager: ITransactionManager;
}

export class RecordStockMovementUseCase {
  constructor(private readonly deps: UseCaseDependencies) {}

  async processIN(input: ProcessINInput): Promise<StockMovement> {
    this.validateDate(input.date);
    this.validateQty(input.qty);

    const { item, baseCurrency } = await this.loadItemContext(input.companyId, input.itemId);
    await this.ensureWarehouseExists(input.warehouseId);

    const converted = this.convertCosts(
      input.unitCostInMoveCurrency,
      input.moveCurrency,
      baseCurrency,
      item.costCurrency,
      input.fxRateMovToBase,
      input.fxRateCCYToBase
    );

    return this.deps.transactionManager.runTransaction(async (txn) => {
      const level = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.warehouseId);
      const qtyBefore = level.qtyOnHand;
      const oldMaxBusinessDate = level.maxBusinessDate;

      const settlesNegativeQty = Math.min(input.qty, Math.max(-qtyBefore, 0));
      const newPositiveQty = input.qty - settlesNegativeQty;

      let newAvgBase = converted.unitCostBase;
      let newAvgCCY = converted.unitCostCCY;

      if (qtyBefore > 0) {
        const newQty = qtyBefore + input.qty;
        newAvgBase = roundByCurrency(
          ((level.avgCostBase * qtyBefore) + (converted.unitCostBase * input.qty)) / newQty,
          baseCurrency
        );
        newAvgCCY = roundByCurrency(
          ((level.avgCostCCY * qtyBefore) + (converted.unitCostCCY * input.qty)) / newQty,
          item.costCurrency
        );
      }

      level.qtyOnHand += input.qty;
      level.avgCostBase = newAvgBase;
      level.avgCostCCY = newAvgCCY;
      level.lastCostBase = converted.unitCostBase;
      level.lastCostCCY = converted.unitCostCCY;
      level.postingSeq += 1;
      level.version += 1;
      level.totalMovements += 1;
      level.maxBusinessDate = this.maxDate(oldMaxBusinessDate, input.date);
      level.updatedAt = new Date();

      const qtyAfter = level.qtyOnHand;
      const isBackdated = input.date < oldMaxBusinessDate;
      const now = new Date();

      const movement = new StockMovement({
        id: this.generateMovementId(),
        companyId: input.companyId,
        date: input.date,
        postingSeq: level.postingSeq,
        createdAt: now,
        createdBy: input.currentUser,
        postedAt: now,
        itemId: item.id,
        warehouseId: input.warehouseId,
        direction: 'IN',
        movementType: input.movementType,
        qty: input.qty,
        uom: item.baseUom,
        referenceType: input.refs.type,
        referenceId: input.refs.docId,
        referenceLineId: input.refs.lineId,
        reversesMovementId: input.refs.reversesMovementId,
        transferPairId: input.refs.transferPairId,
        unitCostBase: converted.unitCostBase,
        totalCostBase: roundMoney(converted.unitCostBase * input.qty),
        unitCostCCY: converted.unitCostCCY,
        totalCostCCY: roundMoney(converted.unitCostCCY * input.qty),
        movementCurrency: input.moveCurrency.toUpperCase(),
        fxRateMovToBase: input.fxRateMovToBase,
        fxRateCCYToBase: converted.fxRateCCYToBase,
        fxRateKind: 'DOCUMENT',
        avgCostBaseAfter: newAvgBase,
        avgCostCCYAfter: newAvgCCY,
        qtyBefore,
        qtyAfter,
        settlesNegativeQty,
        newPositiveQty,
        negativeQtyAtPosting: qtyAfter < 0,
        costSettled: true,
        isBackdated,
        costSource: this.deriveCostSource(input.movementType),
        notes: input.notes,
        metadata: input.metadata,
      });

      level.lastMovementId = movement.id;

      await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, level);
      await this.deps.stockMovementRepository.recordMovement(movement, txn);

      return movement;
    });
  }

  async processOUT(input: ProcessOUTInput): Promise<StockMovement> {
    this.validateDate(input.date);
    this.validateQty(input.qty);

    const { item } = await this.loadItemContext(input.companyId, input.itemId);
    await this.ensureWarehouseExists(input.warehouseId);

    return this.deps.transactionManager.runTransaction(async (txn) => {
      const level = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.warehouseId);
      const qtyBefore = level.qtyOnHand;
      const oldMaxBusinessDate = level.maxBusinessDate;

      let issueCostBase = 0;
      let issueCostCCY = 0;
      let costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';

      const hasForcedCost = input.forcedUnitCostBase !== undefined || input.forcedUnitCostCCY !== undefined;
      if (hasForcedCost) {
        const forcedBase = input.forcedUnitCostBase ?? 0;
        const forcedCCY = input.forcedUnitCostCCY ?? 0;

        if (forcedBase < 0 || Number.isNaN(forcedBase) || forcedCCY < 0 || Number.isNaN(forcedCCY)) {
          throw new Error('Forced OUT costs must be valid non-negative numbers');
        }

        issueCostBase = forcedBase;
        issueCostCCY = forcedCCY;
        costBasis = issueCostBase > 0 || issueCostCCY > 0 ? 'AVG' : 'MISSING';
      } else if (qtyBefore > 0) {
        issueCostBase = level.avgCostBase;
        issueCostCCY = level.avgCostCCY;
        costBasis = 'AVG';
      } else if (level.lastCostBase > 0) {
        issueCostBase = level.lastCostBase;
        issueCostCCY = level.lastCostCCY;
        costBasis = 'LAST_KNOWN';
      }

      const settledQty = Math.min(input.qty, Math.max(qtyBefore, 0));
      const unsettledQty = input.qty - settledQty;
      const costSettled = unsettledQty === 0;

      const effectiveFxCCYToBase = issueCostCCY > 0 ? issueCostBase / issueCostCCY : 1.0;

      level.qtyOnHand -= input.qty;
      level.postingSeq += 1;
      level.version += 1;
      level.totalMovements += 1;
      level.maxBusinessDate = this.maxDate(oldMaxBusinessDate, input.date);
      level.updatedAt = new Date();

      const qtyAfter = level.qtyOnHand;
      const isBackdated = input.date < oldMaxBusinessDate;
      const now = new Date();

      const movement = new StockMovement({
        id: this.generateMovementId(),
        companyId: input.companyId,
        date: input.date,
        postingSeq: level.postingSeq,
        createdAt: now,
        createdBy: input.currentUser,
        postedAt: now,
        itemId: item.id,
        warehouseId: input.warehouseId,
        direction: 'OUT',
        movementType: input.movementType,
        qty: input.qty,
        uom: item.baseUom,
        referenceType: input.refs.type,
        referenceId: input.refs.docId,
        referenceLineId: input.refs.lineId,
        reversesMovementId: input.refs.reversesMovementId,
        transferPairId: input.refs.transferPairId,
        unitCostBase: issueCostBase,
        totalCostBase: roundMoney(issueCostBase * input.qty),
        unitCostCCY: issueCostCCY,
        totalCostCCY: roundMoney(issueCostCCY * input.qty),
        movementCurrency: item.costCurrency,
        fxRateMovToBase: effectiveFxCCYToBase,
        fxRateCCYToBase: effectiveFxCCYToBase,
        fxRateKind: 'EFFECTIVE',
        avgCostBaseAfter: level.avgCostBase,
        avgCostCCYAfter: level.avgCostCCY,
        qtyBefore,
        qtyAfter,
        settledQty,
        unsettledQty,
        unsettledCostBasis: unsettledQty > 0 ? costBasis : undefined,
        negativeQtyAtPosting: qtyAfter < 0,
        costSettled,
        isBackdated,
        costSource: this.deriveCostSource(input.movementType),
        notes: input.notes,
        metadata: input.metadata,
      });

      level.lastMovementId = movement.id;

      await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, level);
      await this.deps.stockMovementRepository.recordMovement(movement, txn);

      return movement;
    });
  }

  async processTRANSFER(input: ProcessTRANSFERInput): Promise<TransferResult> {
    this.validateDate(input.date);
    this.validateQty(input.qty);

    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    const { item } = await this.loadItemContext(input.companyId, input.itemId);
    await this.ensureWarehouseExists(input.sourceWarehouseId);
    await this.ensureWarehouseExists(input.destinationWarehouseId);

    const executeTransfer = async (txn: unknown): Promise<TransferResult> => {
      const pairId = input.transferPairId?.trim() || randomUUID();
      const now = new Date();

      const srcLevel = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.sourceWarehouseId);
      const srcQtyBefore = srcLevel.qtyOnHand;
      const srcOldMaxDate = srcLevel.maxBusinessDate;

      let transferCostBase = 0;
      let transferCostCCY = 0;
      let srcCostBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';

      if (srcQtyBefore > 0) {
        transferCostBase = srcLevel.avgCostBase;
        transferCostCCY = srcLevel.avgCostCCY;
        srcCostBasis = 'AVG';
      } else if (srcLevel.lastCostBase > 0) {
        transferCostBase = srcLevel.lastCostBase;
        transferCostCCY = srcLevel.lastCostCCY;
        srcCostBasis = 'LAST_KNOWN';
      }

      const srcSettledQty = Math.min(input.qty, Math.max(srcQtyBefore, 0));
      const srcUnsettledQty = input.qty - srcSettledQty;

      srcLevel.qtyOnHand -= input.qty;
      srcLevel.postingSeq += 1;
      srcLevel.version += 1;
      srcLevel.totalMovements += 1;
      srcLevel.maxBusinessDate = this.maxDate(srcOldMaxDate, input.date);
      srcLevel.updatedAt = now;

      const srcQtyAfter = srcLevel.qtyOnHand;
      const srcIsBackdated = input.date < srcOldMaxDate;
      const srcFxRate = transferCostCCY > 0 ? transferCostBase / transferCostCCY : 1.0;

      const outMov = new StockMovement({
        id: this.generateMovementId(),
        companyId: input.companyId,
        date: input.date,
        postingSeq: srcLevel.postingSeq,
        createdAt: now,
        createdBy: input.currentUser,
        postedAt: now,
        itemId: item.id,
        warehouseId: input.sourceWarehouseId,
        direction: 'OUT',
        movementType: 'TRANSFER_OUT',
        qty: input.qty,
        uom: item.baseUom,
        referenceType: 'STOCK_TRANSFER',
        referenceId: input.transferDocId,
        transferPairId: pairId,
        unitCostBase: transferCostBase,
        totalCostBase: roundMoney(transferCostBase * input.qty),
        unitCostCCY: transferCostCCY,
        totalCostCCY: roundMoney(transferCostCCY * input.qty),
        movementCurrency: item.costCurrency,
        fxRateMovToBase: srcFxRate,
        fxRateCCYToBase: srcFxRate,
        fxRateKind: 'EFFECTIVE',
        avgCostBaseAfter: srcLevel.avgCostBase,
        avgCostCCYAfter: srcLevel.avgCostCCY,
        qtyBefore: srcQtyBefore,
        qtyAfter: srcQtyAfter,
        settledQty: srcSettledQty,
        unsettledQty: srcUnsettledQty,
        unsettledCostBasis: srcUnsettledQty > 0 ? srcCostBasis : undefined,
        negativeQtyAtPosting: srcQtyAfter < 0,
        costSettled: srcUnsettledQty === 0,
        isBackdated: srcIsBackdated,
        costSource: 'TRANSFER',
        notes: input.notes,
        metadata: input.metadata,
      });

      srcLevel.lastMovementId = outMov.id;

      const dstLevel = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.destinationWarehouseId);
      const dstQtyBefore = dstLevel.qtyOnHand;
      const dstOldMaxDate = dstLevel.maxBusinessDate;

      const dstSettlesNegativeQty = Math.min(input.qty, Math.max(-dstQtyBefore, 0));
      const dstNewPositiveQty = input.qty - dstSettlesNegativeQty;

      if (dstQtyBefore <= 0) {
        dstLevel.avgCostBase = transferCostBase;
        dstLevel.avgCostCCY = transferCostCCY;
      } else {
        const newQty = dstQtyBefore + input.qty;
        dstLevel.avgCostBase = roundMoney(
          ((dstLevel.avgCostBase * dstQtyBefore) + (transferCostBase * input.qty)) / newQty
        );
        dstLevel.avgCostCCY = roundMoney(
          ((dstLevel.avgCostCCY * dstQtyBefore) + (transferCostCCY * input.qty)) / newQty
        );
      }

      dstLevel.qtyOnHand += input.qty;
      dstLevel.lastCostBase = transferCostBase;
      dstLevel.lastCostCCY = transferCostCCY;
      dstLevel.postingSeq += 1;
      dstLevel.version += 1;
      dstLevel.totalMovements += 1;
      dstLevel.maxBusinessDate = this.maxDate(dstOldMaxDate, input.date);
      dstLevel.updatedAt = now;

      const dstQtyAfter = dstLevel.qtyOnHand;
      const dstIsBackdated = input.date < dstOldMaxDate;

      const inMov = new StockMovement({
        id: this.generateMovementId(),
        companyId: input.companyId,
        date: input.date,
        postingSeq: dstLevel.postingSeq,
        createdAt: now,
        createdBy: input.currentUser,
        postedAt: now,
        itemId: item.id,
        warehouseId: input.destinationWarehouseId,
        direction: 'IN',
        movementType: 'TRANSFER_IN',
        qty: input.qty,
        uom: item.baseUom,
        referenceType: 'STOCK_TRANSFER',
        referenceId: input.transferDocId,
        transferPairId: pairId,
        unitCostBase: transferCostBase,
        totalCostBase: roundMoney(transferCostBase * input.qty),
        unitCostCCY: transferCostCCY,
        totalCostCCY: roundMoney(transferCostCCY * input.qty),
        movementCurrency: item.costCurrency,
        fxRateMovToBase: srcFxRate,
        fxRateCCYToBase: srcFxRate,
        fxRateKind: 'EFFECTIVE',
        avgCostBaseAfter: dstLevel.avgCostBase,
        avgCostCCYAfter: dstLevel.avgCostCCY,
        qtyBefore: dstQtyBefore,
        qtyAfter: dstQtyAfter,
        settlesNegativeQty: dstSettlesNegativeQty,
        newPositiveQty: dstNewPositiveQty,
        negativeQtyAtPosting: dstQtyAfter < 0,
        costSettled: true,
        isBackdated: dstIsBackdated,
        costSource: 'TRANSFER',
        notes: input.notes,
        metadata: input.metadata,
      });

      dstLevel.lastMovementId = inMov.id;

      await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, srcLevel);
      await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, dstLevel);
      await this.deps.stockMovementRepository.recordMovement(outMov, txn);
      await this.deps.stockMovementRepository.recordMovement(inMov, txn);

      return { outMov, inMov };
    };

    if (input.transaction) {
      return executeTransfer(input.transaction);
    }

    return this.deps.transactionManager.runTransaction(async (txn) => executeTransfer(txn));
  }

  convertCosts(
    unitCostInMoveCurrency: number,
    moveCurrency: string,
    baseCurrency: string,
    costCurrency: string,
    fxRateMovToBase: number,
    fxRateCCYToBase: number
  ): { unitCostBase: number; unitCostCCY: number; fxRateCCYToBase: number } {
    const move = moveCurrency.toUpperCase();
    const base = baseCurrency.toUpperCase();
    const cost = costCurrency.toUpperCase();

    if (unitCostInMoveCurrency < 0 || Number.isNaN(unitCostInMoveCurrency)) {
      throw new Error('unitCostInMoveCurrency must be a valid non-negative number');
    }

    if (fxRateMovToBase <= 0 || Number.isNaN(fxRateMovToBase)) {
      throw new Error('fxRateMovToBase must be greater than 0');
    }

    if (fxRateCCYToBase <= 0 || Number.isNaN(fxRateCCYToBase)) {
      throw new Error('fxRateCCYToBase must be greater than 0');
    }

    let unitCostBase = 0;
    let unitCostCCY = 0;
    let adjustedFxCCYToBase = fxRateCCYToBase;

    if (move === base) {
      unitCostBase = unitCostInMoveCurrency;
      unitCostCCY = unitCostBase / adjustedFxCCYToBase;
    } else if (move === cost) {
      unitCostCCY = unitCostInMoveCurrency;
      unitCostBase = unitCostCCY * adjustedFxCCYToBase;
    } else {
      unitCostBase = unitCostInMoveCurrency * fxRateMovToBase;
      unitCostCCY = unitCostInMoveCurrency * (fxRateMovToBase / adjustedFxCCYToBase);
    }

    if (cost === base) {
      unitCostCCY = unitCostBase;
      adjustedFxCCYToBase = 1.0;
    }

    unitCostBase = roundByCurrency(unitCostBase, base);
    unitCostCCY = roundByCurrency(unitCostCCY, cost);

    return { unitCostBase, unitCostCCY, fxRateCCYToBase: adjustedFxCCYToBase };
  }

  deriveCostSource(movementType: MovementType): CostSource {
    switch (movementType) {
      case 'PURCHASE_RECEIPT':
        return 'PURCHASE';
      case 'OPENING_STOCK':
        return 'OPENING';
      case 'ADJUSTMENT_IN':
      case 'ADJUSTMENT_OUT':
        return 'ADJUSTMENT';
      case 'TRANSFER_IN':
      case 'TRANSFER_OUT':
        return 'TRANSFER';
      case 'RETURN_IN':
      case 'RETURN_OUT':
        return 'RETURN';
      case 'SALES_DELIVERY':
        return 'PURCHASE';
      default:
        return 'SETTLEMENT';
    }
  }

  private async getOrCreateStockLevel(
    transaction: unknown,
    companyId: string,
    itemId: string,
    warehouseId: string
  ): Promise<StockLevel> {
    const existing = await this.deps.stockLevelRepository.getLevelInTransaction(
      transaction,
      companyId,
      itemId,
      warehouseId
    );

    if (existing) return existing;

    return StockLevel.createNew(companyId, itemId, warehouseId);
  }

  private async loadItemContext(companyId: string, itemId: string): Promise<{ item: Item; baseCurrency: string }> {
    const [item, company] = await Promise.all([
      this.deps.itemRepository.getItem(itemId),
      this.deps.companyRepository.findById(companyId),
    ]);

    if (!item || item.companyId !== companyId) {
      throw new Error(`Item not found: ${itemId}`);
    }

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    return { item, baseCurrency: company.baseCurrency };
  }

  private async ensureWarehouseExists(warehouseId: string): Promise<void> {
    const warehouse = await this.deps.warehouseRepository.getWarehouse(warehouseId);
    if (!warehouse) {
      throw new Error(`Warehouse not found: ${warehouseId}`);
    }
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('date must be in YYYY-MM-DD format');
    }
  }

  private validateQty(qty: number): void {
    if (qty <= 0 || Number.isNaN(qty)) {
      throw new Error('qty must be greater than 0');
    }
  }

  private generateMovementId(): string {
    return `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private maxDate(a: string, b: string): string {
    return b > a ? b : a;
  }
}
