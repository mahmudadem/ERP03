/**
 * PosReceipt — A printed receipt for a completed POS sale.
 *
 * The receipt is the operational/print artifact. The financial truth lives on
 * the linked SalesInvoice (created by CreateAndPostSalesInvoiceUseCase via
 * CompletePosSaleUseCase). `salesInvoiceId` is the link.
 */
export type PosReceiptStatus = 'COMPLETED' | 'VOIDED';

export interface PosReceiptLineSnapshot {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  uom: string;
  unitPrice: number;
  lineDiscount: number;
  taxCodeId?: string;
  lineTotal: number;
  salesInvoiceLineId?: string; // populated by CompletePosSale for P3 returns
}

export interface PosReceiptProps {
  id: string;
  companyId: string;
  shiftId: string;
  registerId: string;
  receiptNumber: string;
  status: PosReceiptStatus;
  customerId: string;
  customerName?: string;
  lines: PosReceiptLineSnapshot[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  salesInvoiceId?: string;
  salesInvoiceNumber?: string;
  createdBy: string;
  createdAt: Date;
}

export class PosReceipt {
  readonly id: string;
  readonly companyId: string;
  readonly shiftId: string;
  readonly registerId: string;
  readonly receiptNumber: string;
  status: PosReceiptStatus;
  readonly customerId: string;
  customerName?: string;
  lines: PosReceiptLineSnapshot[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  salesInvoiceId?: string;
  salesInvoiceNumber?: string;
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(props: PosReceiptProps) {
    if (!props.id?.trim()) throw new Error('PosReceipt id is required');
    if (!props.companyId?.trim()) throw new Error('PosReceipt companyId is required');
    if (!props.shiftId?.trim()) throw new Error('PosReceipt shiftId is required');
    if (!props.registerId?.trim()) throw new Error('PosReceipt registerId is required');
    if (!props.receiptNumber?.trim()) throw new Error('PosReceipt receiptNumber is required');
    if (!props.customerId?.trim()) throw new Error('PosReceipt customerId is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('PosReceipt must have at least one line.');
    }
    const status: PosReceiptStatus = props.status === 'VOIDED' ? 'VOIDED' : 'COMPLETED';

    this.id = props.id;
    this.companyId = props.companyId;
    this.shiftId = props.shiftId;
    this.registerId = props.registerId;
    this.receiptNumber = props.receiptNumber;
    this.status = status;
    this.customerId = props.customerId;
    this.customerName = props.customerName;
    this.lines = props.lines;
    this.subtotal = round2(props.subtotal);
    this.discountTotal = round2(props.discountTotal);
    this.taxTotal = round2(props.taxTotal);
    this.grandTotal = round2(props.grandTotal);
    this.salesInvoiceId = props.salesInvoiceId;
    this.salesInvoiceNumber = props.salesInvoiceNumber;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      shiftId: this.shiftId,
      registerId: this.registerId,
      receiptNumber: this.receiptNumber,
      status: this.status,
      customerId: this.customerId,
      customerName: this.customerName,
      lines: this.lines,
      subtotal: this.subtotal,
      discountTotal: this.discountTotal,
      taxTotal: this.taxTotal,
      grandTotal: this.grandTotal,
      salesInvoiceId: this.salesInvoiceId,
      salesInvoiceNumber: this.salesInvoiceNumber,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosReceipt {
    return new PosReceipt({
      id: data.id,
      companyId: data.companyId,
      shiftId: data.shiftId,
      registerId: data.registerId,
      receiptNumber: data.receiptNumber,
      status: data.status,
      customerId: data.customerId,
      customerName: data.customerName,
      lines: (data.lines || []).map((l: any) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        qty: Number(l.qty),
        uom: l.uom,
        unitPrice: Number(l.unitPrice),
        lineDiscount: Number(l.lineDiscount) || 0,
        taxCodeId: l.taxCodeId,
        lineTotal: Number(l.lineTotal),
        salesInvoiceLineId: l.salesInvoiceLineId,
      })),
      subtotal: Number(data.subtotal) || 0,
      discountTotal: Number(data.discountTotal) || 0,
      taxTotal: Number(data.taxTotal) || 0,
      grandTotal: Number(data.grandTotal) || 0,
      salesInvoiceId: data.salesInvoiceId,
      salesInvoiceNumber: data.salesInvoiceNumber,
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    });
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
