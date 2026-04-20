import { PrismaClient } from '@prisma/client';
import { IPurchaseInvoiceRepository, PurchaseInvoiceListOptions } from '../../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { PaymentStatus, PIStatus, PurchaseInvoice } from '../../../../domain/purchases/entities/PurchaseInvoice';

export class PrismaPurchaseInvoiceRepository implements IPurchaseInvoiceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(invoice: PurchaseInvoice, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.purchaseInvoice.create({
      data: {
        id: invoice.id,
        companyId: invoice.companyId,
        invoiceNumber: invoice.invoiceNumber,
        supplierInvoiceNumber: invoice.vendorInvoiceNumber || null,
        purchaseOrderId: invoice.purchaseOrderId || null,
        goodsReceiptId: (invoice as any).goodsReceiptId || null,
        vendorId: invoice.vendorId,
        vendorName: invoice.vendorName,
        invoiceDate: new Date(invoice.invoiceDate),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        paymentTermsDays: invoice.paymentTermsDays || null,
        paidAmountBase: invoice.paidAmountBase,
        outstandingAmountBase: invoice.outstandingAmountBase,
        voucherId: invoice.voucherId || null,
        subtotalBase: invoice.subtotalBase,
        taxTotalBase: invoice.taxTotalBase,
        grandTotalBase: invoice.grandTotalBase,
        subtotalDoc: invoice.subtotalDoc,
        taxTotalDoc: invoice.taxTotalDoc,
        grandTotalDoc: invoice.grandTotalDoc,
        notes: invoice.notes || null,
        createdBy: invoice.createdBy,
        postedAt: invoice.postedAt || null,
        company: { connect: { id: invoice.companyId } },
        lines: {
          create: invoice.lines.map((line) => ({
            id: line.lineId,
            poLineId: line.poLineId || null,
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
            description: line.description || null,
            grnLineId: line.grnLineId || null,
            accountId: line.accountId || null,
            stockMovementId: line.stockMovementId || null,
          })),
        },
      } as any,
    });
  }

  async update(invoice: PurchaseInvoice, _transaction?: unknown): Promise<void> {
    const tx = (_transaction as any) || this.prisma;
    await tx.purchaseInvoice.update({
      where: { id: invoice.id, companyId: invoice.companyId },
      data: {
        invoiceNumber: invoice.invoiceNumber,
        supplierInvoiceNumber: invoice.vendorInvoiceNumber || null,
        purchaseOrderId: invoice.purchaseOrderId || null,
        goodsReceiptId: (invoice as any).goodsReceiptId || null,
        vendorId: invoice.vendorId,
        vendorName: invoice.vendorName,
        invoiceDate: new Date(invoice.invoiceDate),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        paymentTermsDays: invoice.paymentTermsDays || null,
        paidAmountBase: invoice.paidAmountBase,
        outstandingAmountBase: invoice.outstandingAmountBase,
        voucherId: invoice.voucherId || null,
        subtotalBase: invoice.subtotalBase,
        taxTotalBase: invoice.taxTotalBase,
        grandTotalBase: invoice.grandTotalBase,
        subtotalDoc: invoice.subtotalDoc,
        taxTotalDoc: invoice.taxTotalDoc,
        grandTotalDoc: invoice.grandTotalDoc,
        notes: invoice.notes || null,
        postedAt: invoice.postedAt || null,
        lines: {
          deleteMany: {},
          create: invoice.lines.map((line) => ({
            id: line.lineId,
            poLineId: line.poLineId || null,
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
            description: line.description || null,
            grnLineId: line.grnLineId || null,
            accountId: line.accountId || null,
            stockMovementId: line.stockMovementId || null,
          })),
        },
      } as any,
    });
  }

  async getById(companyId: string, id: string): Promise<PurchaseInvoice | null> {
    const record = await this.prisma.purchaseInvoice.findUnique({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByNumber(companyId: string, invoiceNumber: string): Promise<PurchaseInvoice | null> {
    const record = await this.prisma.purchaseInvoice.findUnique({
      where: { companyId_invoiceNumber: { companyId, invoiceNumber } },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: PurchaseInvoiceListOptions): Promise<PurchaseInvoice[]> {
    const where: any = { companyId };
    if (opts?.vendorId) where.vendorId = opts.vendorId;
    if (opts?.purchaseOrderId) where.purchaseOrderId = opts.purchaseOrderId;
    if (opts?.status) where.status = opts.status;
    if (opts?.paymentStatus) where.paymentStatus = opts.paymentStatus;

    const records = await this.prisma.purchaseInvoice.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): PurchaseInvoice {
    const lines = (record.lines || []).map((line: any) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      poLineId: line.poLineId || undefined,
      grnLineId: line.grnLineId || undefined,
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
      accountId: line.accountId || '',
      stockMovementId: line.stockMovementId || undefined,
      description: line.description || undefined,
    }));

    return PurchaseInvoice.fromJSON({
      id: record.id,
      companyId: record.companyId,
      invoiceNumber: record.invoiceNumber,
      vendorInvoiceNumber: record.supplierInvoiceNumber || undefined,
      purchaseOrderId: record.purchaseOrderId || undefined,
      vendorId: record.vendorId,
      vendorName: record.vendorName,
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
      status: record.status as PIStatus,
      voucherId: record.voucherId || null,
      notes: record.notes || undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      postedAt: record.postedAt || undefined,
    });
  }
}
