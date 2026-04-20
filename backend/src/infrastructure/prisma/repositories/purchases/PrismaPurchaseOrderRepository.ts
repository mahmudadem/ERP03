import { PrismaClient } from '@prisma/client';
import { IPurchaseOrderRepository, PurchaseOrderListOptions } from '../../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { POStatus, PurchaseOrder } from '../../../../domain/purchases/entities/PurchaseOrder';

export class PrismaPurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(po: PurchaseOrder, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.purchaseOrder.create({
      data: {
        id: po.id,
        companyId: po.companyId,
        orderNumber: po.orderNumber,
        vendorId: po.vendorId,
        vendorName: po.vendorName,
        orderDate: new Date(po.orderDate),
        expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null,
        currency: po.currency,
        exchangeRate: po.exchangeRate,
        status: po.status,
        notes: po.notes || null,
        internalNotes: po.internalNotes || null,
        subtotalBase: po.subtotalBase,
        taxTotalBase: po.taxTotalBase,
        grandTotalBase: po.grandTotalBase,
        subtotalDoc: po.subtotalDoc,
        taxTotalDoc: po.taxTotalDoc,
        grandTotalDoc: po.grandTotalDoc,
        createdBy: po.createdBy,
        confirmedAt: po.confirmedAt || null,
        closedAt: po.closedAt || null,
        company: { connect: { id: po.companyId } },
        lines: {
          create: po.lines.map((line) => ({
            id: line.lineId,
            lineNo: line.lineNo,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            itemType: line.itemType,
            trackInventory: line.trackInventory,
            orderedQty: line.orderedQty,
            uomId: line.uomId || null,
            uom: line.uom,
            receivedQty: line.receivedQty,
            invoicedQty: line.invoicedQty,
            returnedQty: line.returnedQty,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId || null,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId || null,
            description: line.description || null,
          })),
        },
      } as any,
    });
  }

  async update(po: PurchaseOrder, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.purchaseOrder.update({
      where: { id: po.id, companyId: po.companyId },
      data: {
        orderNumber: po.orderNumber,
        vendorId: po.vendorId,
        vendorName: po.vendorName,
        orderDate: new Date(po.orderDate),
        expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null,
        currency: po.currency,
        exchangeRate: po.exchangeRate,
        status: po.status,
        notes: po.notes || null,
        internalNotes: po.internalNotes || null,
        subtotalBase: po.subtotalBase,
        taxTotalBase: po.taxTotalBase,
        grandTotalBase: po.grandTotalBase,
        subtotalDoc: po.subtotalDoc,
        taxTotalDoc: po.taxTotalDoc,
        grandTotalDoc: po.grandTotalDoc,
        confirmedAt: po.confirmedAt || null,
        closedAt: po.closedAt || null,
        lines: {
          deleteMany: {},
          create: po.lines.map((line) => ({
            id: line.lineId,
            lineNo: line.lineNo,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            itemType: line.itemType,
            trackInventory: line.trackInventory,
            orderedQty: line.orderedQty,
            uomId: line.uomId || null,
            uom: line.uom,
            receivedQty: line.receivedQty,
            invoicedQty: line.invoicedQty,
            returnedQty: line.returnedQty,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId || null,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId || null,
            description: line.description || null,
          })),
        },
      } as any,
    });
  }

  async getById(companyId: string, id: string): Promise<PurchaseOrder | null> {
    const record = await this.prisma.purchaseOrder.findUnique({
      where: { id, companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByNumber(companyId: string, orderNumber: string): Promise<PurchaseOrder | null> {
    const record = await this.prisma.purchaseOrder.findUnique({
      where: { companyId_orderNumber: { companyId, orderNumber } },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: PurchaseOrderListOptions): Promise<PurchaseOrder[]> {
    const where: any = { companyId };
    if (opts?.status) where.status = opts.status;
    if (opts?.vendorId) where.vendorId = opts.vendorId;

    const records = await this.prisma.purchaseOrder.findMany({
      where,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.purchaseOrder.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): PurchaseOrder {
    const lines = (record.lines || []).map((line: any) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      itemType: line.itemType as any,
      trackInventory: line.trackInventory,
      orderedQty: line.orderedQty,
      uomId: line.uomId || undefined,
      uom: line.uom,
      receivedQty: line.receivedQty,
      invoicedQty: line.invoicedQty,
      returnedQty: line.returnedQty,
      unitPriceDoc: line.unitPriceDoc,
      lineTotalDoc: line.lineTotalDoc,
      unitPriceBase: line.unitPriceBase,
      lineTotalBase: line.lineTotalBase,
      taxCodeId: line.taxCodeId || undefined,
      taxRate: line.taxRate,
      taxAmountDoc: line.taxAmountDoc,
      taxAmountBase: line.taxAmountBase,
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    }));

    return PurchaseOrder.fromJSON({
      id: record.id,
      companyId: record.companyId,
      orderNumber: record.orderNumber,
      vendorId: record.vendorId,
      vendorName: record.vendorName,
      orderDate: record.orderDate instanceof Date ? record.orderDate.toISOString().split('T')[0] : String(record.orderDate).split('T')[0],
      expectedDeliveryDate: record.expectedDeliveryDate
        ? record.expectedDeliveryDate instanceof Date
          ? record.expectedDeliveryDate.toISOString().split('T')[0]
          : String(record.expectedDeliveryDate).split('T')[0]
        : undefined,
      currency: record.currency,
      exchangeRate: record.exchangeRate,
      lines,
      subtotalBase: record.subtotalBase,
      taxTotalBase: record.taxTotalBase,
      grandTotalBase: record.grandTotalBase,
      subtotalDoc: record.subtotalDoc,
      taxTotalDoc: record.taxTotalDoc,
      grandTotalDoc: record.grandTotalDoc,
      status: record.status as POStatus,
      notes: record.notes || undefined,
      internalNotes: record.internalNotes || undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      confirmedAt: record.confirmedAt || undefined,
      closedAt: record.closedAt || undefined,
    });
  }
}
