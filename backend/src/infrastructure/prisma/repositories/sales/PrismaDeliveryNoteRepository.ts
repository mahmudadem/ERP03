import { PrismaClient } from '@prisma/client';
import { IDeliveryNoteRepository, DeliveryNoteListOptions } from '../../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { DNStatus, DeliveryNote } from '../../../../domain/sales/entities/DeliveryNote';

export class PrismaDeliveryNoteRepository implements IDeliveryNoteRepository {
  constructor(private prisma: PrismaClient) {}

  async create(dn: DeliveryNote, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.deliveryNote.create({
      data: {
        id: dn.id,
        companyId: dn.companyId,
        documentNo: dn.dnNumber,
        salesOrderId: dn.salesOrderId || null,
        customerId: dn.customerId,
        customerName: dn.customerName,
        deliveryDate: new Date(dn.deliveryDate),
        currency: (dn as any).currency || 'USD',
        exchangeRate: (dn as any).exchangeRate || 1.0,
        status: dn.status,
        notes: dn.notes || null,
        createdBy: dn.createdBy,
        warehouseId: dn.warehouseId,
        cogsVoucherId: dn.cogsVoucherId || null,
        company: { connect: { id: dn.companyId } },
        lines: {
          create: dn.lines.map((line) => ({
            id: line.lineId,
            soLineId: line.soLineId || null,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            deliveredQty: line.deliveredQty,
            uom: line.uom,
            warehouseId: (dn as any).warehouseId || null,
            unitCostBase: line.unitCostBase,
            lineCostBase: line.lineCostBase,
            moveCurrency: line.moveCurrency,
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            stockMovementId: line.stockMovementId || null,
            notes: line.description || null,
          })),
        },
      } as any,
    });
  }

  async update(dn: DeliveryNote, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.deliveryNote.update({
      where: { id: dn.id, companyId: dn.companyId },
      data: {
        documentNo: dn.dnNumber,
        salesOrderId: dn.salesOrderId || null,
        customerId: dn.customerId,
        customerName: dn.customerName,
        deliveryDate: new Date(dn.deliveryDate),
        status: dn.status,
        notes: dn.notes || null,
        cogsVoucherId: dn.cogsVoucherId || null,
        warehouseId: dn.warehouseId,
        lines: {
          deleteMany: {},
          create: dn.lines.map((line) => ({
            id: line.lineId,
            soLineId: line.soLineId || null,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            deliveredQty: line.deliveredQty,
            uom: line.uom,
            warehouseId: dn.warehouseId,
            unitCostBase: line.unitCostBase,
            lineCostBase: line.lineCostBase,
            moveCurrency: line.moveCurrency,
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            stockMovementId: line.stockMovementId || null,
            notes: line.description || null,
          })),
        },
      } as any,
    });
  }

  async getById(companyId: string, id: string): Promise<DeliveryNote | null> {
    const record = await this.prisma.deliveryNote.findUnique({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByNumber(companyId: string, dnNumber: string): Promise<DeliveryNote | null> {
    const record = await this.prisma.deliveryNote.findUnique({
      where: { companyId_documentNo: { companyId, documentNo: dnNumber } },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: DeliveryNoteListOptions): Promise<DeliveryNote[]> {
    const where: any = { companyId };
    if (opts?.salesOrderId) where.salesOrderId = opts.salesOrderId;
    if (opts?.status) where.status = opts.status;

    const records = await this.prisma.deliveryNote.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): DeliveryNote {
    const lines = (record.lines || []).map((line: any) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      soLineId: line.soLineId || undefined,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      deliveredQty: line.deliveredQty,
      uomId: line.uomId || undefined,
      uom: line.uom,
      unitCostBase: line.unitCostBase || 0,
      lineCostBase: line.lineCostBase || 0,
      moveCurrency: line.moveCurrency || 'USD',
      fxRateMovToBase: line.fxRateMovToBase || 1,
      fxRateCCYToBase: line.fxRateCCYToBase || 1,
      stockMovementId: line.stockMovementId || undefined,
      description: line.notes || undefined,
    }));

    return DeliveryNote.fromJSON({
      id: record.id,
      companyId: record.companyId,
      dnNumber: record.documentNo,
      salesOrderId: record.salesOrderId || undefined,
      customerId: record.customerId,
      customerName: record.customerName,
      deliveryDate: record.deliveryDate instanceof Date ? record.deliveryDate.toISOString().split('T')[0] : String(record.deliveryDate).split('T')[0],
      warehouseId: record.warehouseId || '',
      lines,
      status: record.status as DNStatus,
      notes: record.notes || undefined,
      cogsVoucherId: record.cogsVoucherId || null,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      postedAt: record.postedAt || undefined,
    });
  }
}
