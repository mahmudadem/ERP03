import { PrismaClient } from '@prisma/client';
import { IStockMovementRepository, MovementQueryOptions } from '../../../../repository/interfaces/inventory/IStockMovementRepository';
import { StockMovement, ReferenceType, MovementType, StockDirection } from '../../../../domain/inventory/entities/StockMovement';

export class PrismaStockMovementRepository implements IStockMovementRepository {
  constructor(private prisma: PrismaClient) {}

  async recordMovement(movement: StockMovement, transaction?: unknown): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    await prisma.stockMovement.create({
      data: {
        id: movement.id,
        companyId: movement.companyId,
        date: movement.date,
        postingSeq: movement.postingSeq,
        createdBy: movement.createdBy,
        postedAt: movement.postedAt,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        direction: movement.direction,
        movementType: movement.movementType,
        qty: movement.qty,
        uom: movement.uom,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId || null,
        referenceLineId: movement.referenceLineId || null,
        reversesMovementId: movement.reversesMovementId || null,
        transferPairId: movement.transferPairId || null,
        unitCostBase: movement.unitCostBase,
        totalCostBase: movement.totalCostBase,
        unitCostCCY: movement.unitCostCCY,
        totalCostCCY: movement.totalCostCCY,
        movementCurrency: movement.movementCurrency,
        fxRateMovToBase: movement.fxRateMovToBase,
        fxRateCCYToBase: movement.fxRateCCYToBase,
        fxRateKind: movement.fxRateKind,
        avgCostBaseAfter: movement.avgCostBaseAfter,
        avgCostCCYAfter: movement.avgCostCCYAfter,
        qtyBefore: movement.qtyBefore,
        qtyAfter: movement.qtyAfter,
        settledQty: movement.settledQty ?? null,
        unsettledQty: movement.unsettledQty ?? null,
        unsettledCostBasis: movement.unsettledCostBasis || null,
        settlesNegativeQty: movement.settlesNegativeQty ?? null,
        newPositiveQty: movement.newPositiveQty ?? null,
        negativeQtyAtPosting: movement.negativeQtyAtPosting,
        costSettled: movement.costSettled,
        isBackdated: movement.isBackdated,
        costSource: movement.costSource,
        notes: movement.notes || null,
        metadata: (movement.metadata as any) || null,
      } as any,
    });
  }

  async getItemMovements(companyId: string, itemId: string, opts?: MovementQueryOptions): Promise<StockMovement[]> {
    const where: any = { companyId, itemId };
    if (opts?.movementType !== undefined) {
      where.movementType = opts.movementType;
    }
    if (opts?.direction !== undefined) {
      where.direction = opts.direction;
    }
    const records = await this.prisma.stockMovement.findMany({
      where,
      orderBy: { postingSeq: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getWarehouseMovements(companyId: string, warehouseId: string, opts?: MovementQueryOptions): Promise<StockMovement[]> {
    const where: any = { companyId, warehouseId };
    if (opts?.movementType !== undefined) {
      where.movementType = opts.movementType;
    }
    if (opts?.direction !== undefined) {
      where.direction = opts.direction;
    }
    const records = await this.prisma.stockMovement.findMany({
      where,
      orderBy: { postingSeq: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getMovementsByReference(companyId: string, referenceType: ReferenceType, referenceId: string): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({
      where: { companyId, referenceType: referenceType as any, referenceId },
      orderBy: { postingSeq: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getMovementByReference(
    companyId: string,
    referenceType: ReferenceType,
    referenceId: string,
    referenceLineId?: string
  ): Promise<StockMovement | null> {
    const where: any = { companyId, referenceType: referenceType as any, referenceId };
    if (referenceLineId !== undefined) {
      where.referenceLineId = referenceLineId;
    }
    const record = await this.prisma.stockMovement.findFirst({
      where,
      orderBy: { postingSeq: 'asc' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getMovementsByDateRange(companyId: string, from: string, to: string, opts?: MovementQueryOptions): Promise<StockMovement[]> {
    const where: any = {
      companyId,
      date: {
        gte: from,
        lte: to,
      },
    };
    if (opts?.movementType !== undefined) {
      where.movementType = opts.movementType;
    }
    if (opts?.direction !== undefined) {
      where.direction = opts.direction;
    }
    const records = await this.prisma.stockMovement.findMany({
      where,
      orderBy: { postingSeq: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getUnsettledMovements(companyId: string): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({
      where: { companyId, costSettled: false },
      orderBy: { postingSeq: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getMovement(id: string): Promise<StockMovement | null> {
    const record = await this.prisma.stockMovement.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async deleteMovement(companyId: string, id: string, transaction?: unknown): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    await prisma.stockMovement.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): StockMovement {
    return StockMovement.fromJSON({
      id: record.id,
      companyId: record.companyId,
      date: record.date,
      postingSeq: record.postingSeq,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      postedAt: record.postedAt,
      itemId: record.itemId,
      warehouseId: record.warehouseId,
      direction: record.direction,
      movementType: record.movementType,
      qty: record.qty,
      uom: record.uom,
      referenceType: record.referenceType,
      referenceId: record.referenceId,
      referenceLineId: record.referenceLineId,
      reversesMovementId: record.reversesMovementId,
      transferPairId: record.transferPairId,
      unitCostBase: record.unitCostBase,
      totalCostBase: record.totalCostBase,
      unitCostCCY: record.unitCostCCY,
      totalCostCCY: record.totalCostCCY,
      movementCurrency: record.movementCurrency,
      fxRateMovToBase: record.fxRateMovToBase,
      fxRateCCYToBase: record.fxRateCCYToBase,
      fxRateKind: record.fxRateKind,
      avgCostBaseAfter: record.avgCostBaseAfter,
      avgCostCCYAfter: record.avgCostCCYAfter,
      qtyBefore: record.qtyBefore,
      qtyAfter: record.qtyAfter,
      settledQty: record.settledQty,
      unsettledQty: record.unsettledQty,
      unsettledCostBasis: record.unsettledCostBasis as any,
      settlesNegativeQty: record.settlesNegativeQty,
      newPositiveQty: record.newPositiveQty,
      negativeQtyAtPosting: record.negativeQtyAtPosting,
      costSettled: record.costSettled,
      isBackdated: record.isBackdated,
      costSource: record.costSource,
      notes: record.notes,
      metadata: record.metadata,
    });
  }
}
