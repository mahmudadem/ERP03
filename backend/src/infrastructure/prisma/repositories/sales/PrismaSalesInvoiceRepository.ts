import { PrismaClient } from '@prisma/client';
import { ISalesInvoiceRepository, SalesInvoiceListOptions } from '../../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { PaymentStatus, SIStatus, SalesInvoice } from '../../../../domain/sales/entities/SalesInvoice';

export class PrismaSalesInvoiceRepository implements ISalesInvoiceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(si: SalesInvoice, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.salesInvoice.create({
      data: {
        id: si.id,
        companyId: si.companyId,
        invoiceNumber: si.invoiceNumber,
        customerInvoiceNumber: si.customerInvoiceNumber || null,
        salesOrderId: si.salesOrderId || null,
        customerId: si.customerId,
        customerName: si.customerName,
        invoiceDate: new Date(si.invoiceDate),
        dueDate: si.dueDate ? new Date(si.dueDate) : null,
        currency: si.currency,
        exchangeRate: si.exchangeRate,
        status: si.status,
        paymentStatus: si.paymentStatus,
        paymentTermsDays: si.paymentTermsDays || null,
        paidAmountBase: si.paidAmountBase,
        outstandingAmountBase: si.outstandingAmountBase,
        voucherId: si.voucherId || null,
        cogsVoucherId: si.cogsVoucherId || null,
        subtotalBase: si.subtotalBase,
        taxTotalBase: si.taxTotalBase,
        grandTotalBase: si.grandTotalBase,
        subtotalDoc: si.subtotalDoc,
        taxTotalDoc: si.taxTotalDoc,
        grandTotalDoc: si.grandTotalDoc,
        notes: si.notes || null,
        createdBy: si.createdBy,
        postedAt: si.postedAt || null,
        company: { connect: { id: si.companyId } },
        lines: {
          create: si.lines.map((line) => ({
            id: line.lineId,
            soLineId: line.soLineId || null,
            dnLineId: line.dnLineId || null,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            trackInventory: line.trackInventory,
            invoicedQty: line.invoicedQty,
            uomId: line.uomId || null,
            uom: line.uom,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId || null,
            taxCode: line.taxCode || null,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId || null,
            revenueAccountId: line.revenueAccountId,
            cogsAccountId: line.cogsAccountId || null,
            inventoryAccountId: line.inventoryAccountId || null,
            unitCostBase: line.unitCostBase || null,
            lineCostBase: line.lineCostBase || null,
            stockMovementId: line.stockMovementId || null,
            description: line.description || null,
          })),
        },
      } as any,
    });
  }

  async update(si: SalesInvoice, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.salesInvoice.update({
      where: { id: si.id, companyId: si.companyId },
      data: {
        invoiceNumber: si.invoiceNumber,
        customerInvoiceNumber: si.customerInvoiceNumber || null,
        salesOrderId: si.salesOrderId || null,
        customerId: si.customerId,
        customerName: si.customerName,
        invoiceDate: new Date(si.invoiceDate),
        dueDate: si.dueDate ? new Date(si.dueDate) : null,
        currency: si.currency,
        exchangeRate: si.exchangeRate,
        status: si.status,
        paymentStatus: si.paymentStatus,
        paymentTermsDays: si.paymentTermsDays || null,
        paidAmountBase: si.paidAmountBase,
        outstandingAmountBase: si.outstandingAmountBase,
        voucherId: si.voucherId || null,
        cogsVoucherId: si.cogsVoucherId || null,
        subtotalBase: si.subtotalBase,
        taxTotalBase: si.taxTotalBase,
        grandTotalBase: si.grandTotalBase,
        subtotalDoc: si.subtotalDoc,
        taxTotalDoc: si.taxTotalDoc,
        grandTotalDoc: si.grandTotalDoc,
        notes: si.notes || null,
        postedAt: si.postedAt || null,
        lines: {
          deleteMany: {},
          create: si.lines.map((line) => ({
            id: line.lineId,
            soLineId: line.soLineId || null,
            dnLineId: line.dnLineId || null,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            trackInventory: line.trackInventory,
            invoicedQty: line.invoicedQty,
            uomId: line.uomId || null,
            uom: line.uom,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId || null,
            taxCode: line.taxCode || null,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId || null,
            revenueAccountId: line.revenueAccountId,
            cogsAccountId: line.cogsAccountId || null,
            inventoryAccountId: line.inventoryAccountId || null,
            unitCostBase: line.unitCostBase || null,
            lineCostBase: line.lineCostBase || null,
            stockMovementId: line.stockMovementId || null,
            description: line.description || null,
          })),
        },
      } as any,
    });
  }

  async getById(companyId: string, id: string): Promise<SalesInvoice | null> {
    const record = await this.prisma.salesInvoice.findUnique({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByNumber(companyId: string, number: string): Promise<SalesInvoice | null> {
    const record = await this.prisma.salesInvoice.findUnique({
      where: { companyId_invoiceNumber: { companyId, invoiceNumber: number } },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: SalesInvoiceListOptions): Promise<SalesInvoice[]> {
    const where: any = { companyId };
    if (opts?.customerId) where.customerId = opts.customerId;
    if (opts?.salesOrderId) where.salesOrderId = opts.salesOrderId;
    if (opts?.status) where.status = opts.status;
    if (opts?.paymentStatus) where.paymentStatus = opts.paymentStatus;

    const records = await this.prisma.salesInvoice.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): SalesInvoice {
    const lines = (record.lines || []).map((line: any) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      soLineId: line.soLineId || undefined,
      dnLineId: line.dnLineId || undefined,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      trackInventory: line.trackInventory,
      invoicedQty: line.invoicedQty,
      uomId: line.uomId || undefined,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      lineTotalDoc: line.lineTotalDoc,
      unitPriceBase: line.unitPriceBase,
      lineTotalBase: line.lineTotalBase,
      taxCodeId: line.taxCodeId || undefined,
      taxCode: line.taxCode || undefined,
      taxRate: line.taxRate,
      taxAmountDoc: line.taxAmountDoc,
      taxAmountBase: line.taxAmountBase,
      warehouseId: line.warehouseId || undefined,
      revenueAccountId: line.revenueAccountId,
      cogsAccountId: line.cogsAccountId || undefined,
      inventoryAccountId: line.inventoryAccountId || undefined,
      unitCostBase: line.unitCostBase || undefined,
      lineCostBase: line.lineCostBase || undefined,
      stockMovementId: line.stockMovementId || undefined,
      description: line.description || undefined,
    }));

    return SalesInvoice.fromJSON({
      id: record.id,
      companyId: record.companyId,
      invoiceNumber: record.invoiceNumber,
      customerInvoiceNumber: record.customerInvoiceNumber || undefined,
      salesOrderId: record.salesOrderId || undefined,
      customerId: record.customerId,
      customerName: record.customerName,
      invoiceDate: record.invoiceDate instanceof Date ? record.invoiceDate.toISOString().split('T')[0] : String(record.invoiceDate).split('T')[0],
      dueDate: record.dueDate
        ? record.dueDate instanceof Date
          ? record.dueDate.toISOString().split('T')[0]
          : String(record.dueDate).split('T')[0]
        : undefined,
      currency: record.currency,
      exchangeRate: record.exchangeRate,
      lines,
      subtotalDoc: record.subtotalDoc,
      taxTotalDoc: record.taxTotalDoc,
      grandTotalDoc: record.grandTotalDoc,
      subtotalBase: record.subtotalBase,
      taxTotalBase: record.taxTotalBase,
      grandTotalBase: record.grandTotalBase,
      paymentTermsDays: record.paymentTermsDays || 0,
      paymentStatus: record.paymentStatus as PaymentStatus,
      paidAmountBase: record.paidAmountBase,
      outstandingAmountBase: record.outstandingAmountBase,
      status: record.status as SIStatus,
      voucherId: record.voucherId || null,
      cogsVoucherId: record.cogsVoucherId || null,
      notes: record.notes || undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      postedAt: record.postedAt || undefined,
    });
  }
}
