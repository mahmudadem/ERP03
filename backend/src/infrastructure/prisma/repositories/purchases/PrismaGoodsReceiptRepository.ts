import { PrismaClient } from '@prisma/client';
import { IGoodsReceiptRepository, GoodsReceiptListOptions } from '../../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { GRNStatus, GoodsReceipt } from '../../../../domain/purchases/entities/GoodsReceipt';

export class PrismaGoodsReceiptRepository implements IGoodsReceiptRepository {
  constructor(private prisma: PrismaClient) {}

  async create(grn: GoodsReceipt, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.goodsReceipt.create({
      data: {
        id: grn.id,
        companyId: grn.companyId,
        documentNo: grn.grnNumber,
        purchaseOrderId: grn.purchaseOrderId || null,
        vendorId: grn.vendorId,
        vendorName: grn.vendorName,
        receiptDate: new Date(grn.receiptDate),
        currency: (grn as any).currency || 'USD',
        exchangeRate: (grn as any).exchangeRate || 1.0,
        status: grn.status,
        notes: grn.notes || null,
        createdBy: grn.createdBy,
        warehouseId: grn.warehouseId,
        voucherId: grn.voucherId || null,
        company: { connect: { id: grn.companyId } },
        lines: {
          create: grn.lines.map((line) => ({
            id: line.lineId,
            poLineId: line.poLineId || null,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            receivedQty: line.receivedQty,
            uom: line.uom,
            unitCostDoc: line.unitCostDoc,
            unitCostBase: line.unitCostBase,
            moveCurrency: line.moveCurrency,
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            stockMovementId: line.stockMovementId || null,
            notes: line.description || null,
            warehouseId: grn.warehouseId,
          })),
        },
      } as any,
    });
  }

  async update(grn: GoodsReceipt, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.goodsReceipt.update({
      where: { id: grn.id, companyId: grn.companyId },
      data: {
        documentNo: grn.grnNumber,
        purchaseOrderId: grn.purchaseOrderId || null,
        vendorId: grn.vendorId,
        vendorName: grn.vendorName,
        receiptDate: new Date(grn.receiptDate),
        status: grn.status,
        notes: grn.notes || null,
        voucherId: grn.voucherId || null,
        warehouseId: grn.warehouseId,
        lines: {
          deleteMany: {},
          create: grn.lines.map((line) => ({
            id: line.lineId,
            poLineId: line.poLineId || null,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            receivedQty: line.receivedQty,
            uom: line.uom,
            unitCostDoc: line.unitCostDoc,
            unitCostBase: line.unitCostBase,
            moveCurrency: line.moveCurrency,
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            stockMovementId: line.stockMovementId || null,
            notes: line.description || null,
            warehouseId: grn.warehouseId,
          })),
        },
      } as any,
    });
  }

  async getById(companyId: string, id: string): Promise<GoodsReceipt | null> {
    const record = await this.prisma.goodsReceipt.findUnique({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: GoodsReceiptListOptions): Promise<GoodsReceipt[]> {
    const where: any = { companyId };
    if (opts?.purchaseOrderId) where.purchaseOrderId = opts.purchaseOrderId;
    if (opts?.status) where.status = opts.status;

    const records = await this.prisma.goodsReceipt.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): GoodsReceipt {
    const lines = (record.lines || []).map((line: any) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      poLineId: line.poLineId || undefined,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      receivedQty: line.receivedQty,
      uomId: line.uomId || undefined,
      uom: line.uom,
      unitCostDoc: line.unitCostDoc || 0,
      unitCostBase: line.unitCostBase || 0,
      moveCurrency: line.moveCurrency || 'USD',
      fxRateMovToBase: line.fxRateMovToBase || 1,
      fxRateCCYToBase: line.fxRateCCYToBase || 1,
      stockMovementId: line.stockMovementId || undefined,
      description: line.notes || undefined,
    }));

    return GoodsReceipt.fromJSON({
      id: record.id,
      companyId: record.companyId,
      grnNumber: record.documentNo,
      purchaseOrderId: record.purchaseOrderId || undefined,
      vendorId: record.vendorId,
      vendorName: record.vendorName,
      receiptDate: record.receiptDate instanceof Date ? record.receiptDate.toISOString().split('T')[0] : String(record.receiptDate).split('T')[0],
      warehouseId: record.warehouseId || '',
      lines,
      status: record.status as GRNStatus,
      notes: record.notes || undefined,
      voucherId: record.voucherId || null,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      postedAt: record.postedAt || undefined,
    });
  }
}
