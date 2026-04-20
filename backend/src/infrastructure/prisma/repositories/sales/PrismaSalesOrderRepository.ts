import { PrismaClient } from '@prisma/client';
import { ISalesOrderRepository, SalesOrderListOptions } from '../../../../repository/interfaces/sales/ISalesOrderRepository';
import { SOStatus, SalesOrder } from '../../../../domain/sales/entities/SalesOrder';

export class PrismaSalesOrderRepository implements ISalesOrderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(so: SalesOrder, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.salesOrder.create({
      data: {
        id: so.id,
        companyId: so.companyId,
        orderNumber: so.orderNumber,
        customerId: so.customerId,
        customerName: so.customerName,
        orderDate: new Date(so.orderDate),
        expectedDeliveryDate: so.expectedDeliveryDate ? new Date(so.expectedDeliveryDate) : null,
        currency: so.currency,
        exchangeRate: so.exchangeRate,
        status: so.status,
        notes: so.notes || null,
        internalNotes: so.internalNotes || null,
        subtotalBase: so.subtotalBase,
        taxTotalBase: so.taxTotalBase,
        grandTotalBase: so.grandTotalBase,
        subtotalDoc: so.subtotalDoc,
        taxTotalDoc: so.taxTotalDoc,
        grandTotalDoc: so.grandTotalDoc,
        createdBy: so.createdBy,
        confirmedAt: so.confirmedAt || null,
        closedAt: so.closedAt || null,
        company: { connect: { id: so.companyId } },
        lines: {
          create: so.lines.map((line) => ({
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
            deliveredQty: line.deliveredQty,
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

  async update(so: SalesOrder, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.salesOrder.update({
      where: { id: so.id, companyId: so.companyId },
      data: {
        orderNumber: so.orderNumber,
        customerId: so.customerId,
        customerName: so.customerName,
        orderDate: new Date(so.orderDate),
        expectedDeliveryDate: so.expectedDeliveryDate ? new Date(so.expectedDeliveryDate) : null,
        currency: so.currency,
        exchangeRate: so.exchangeRate,
        status: so.status,
        notes: so.notes || null,
        internalNotes: so.internalNotes || null,
        subtotalBase: so.subtotalBase,
        taxTotalBase: so.taxTotalBase,
        grandTotalBase: so.grandTotalBase,
        subtotalDoc: so.subtotalDoc,
        taxTotalDoc: so.taxTotalDoc,
        grandTotalDoc: so.grandTotalDoc,
        confirmedAt: so.confirmedAt || null,
        closedAt: so.closedAt || null,
        lines: {
          deleteMany: {},
          create: so.lines.map((line) => ({
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
            deliveredQty: line.deliveredQty,
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

  async getById(companyId: string, id: string): Promise<SalesOrder | null> {
    const record = await this.prisma.salesOrder.findUnique({
      where: { id, companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByNumber(companyId: string, orderNumber: string): Promise<SalesOrder | null> {
    const record = await this.prisma.salesOrder.findUnique({
      where: { companyId_orderNumber: { companyId, orderNumber } },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: SalesOrderListOptions): Promise<SalesOrder[]> {
    const where: any = { companyId };
    if (opts?.status) where.status = opts.status;
    if (opts?.customerId) where.customerId = opts.customerId;

    const records = await this.prisma.salesOrder.findMany({
      where,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.salesOrder.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): SalesOrder {
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
      deliveredQty: line.deliveredQty,
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

    return SalesOrder.fromJSON({
      id: record.id,
      companyId: record.companyId,
      orderNumber: record.orderNumber,
      customerId: record.customerId,
      customerName: record.customerName,
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
      status: record.status as SOStatus,
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
