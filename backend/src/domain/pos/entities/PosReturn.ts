/**
 * PosReturn — A receipt-based return.
 *
 * The return is the operational/print artifact. The financial truth lives on
 * the linked POS return posting result. `salesReturnId` remains as a legacy API
 * link field.
 */
export type PosReturnRefundMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';

export interface PosReturnLine {
  itemId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  originalLineId?: string;
}

export interface PosReturnProps {
  id: string;
  companyId: string;
  shiftId: string;
  registerId: string;
  returnNumber: string;
  originalReceiptId: string;
  originalReceiptNumber: string;
  salesInvoiceId: string;
  lines: PosReturnLine[];
  refundMethod: PosReturnRefundMethod;
  refundTotal: number;
  salesReturnId?: string;
  salesReturnNumber?: string;
  exchangeId?: string;
  createdBy: string;
  createdAt: Date;
}

export class PosReturn {
  readonly id: string;
  readonly companyId: string;
  readonly shiftId: string;
  readonly registerId: string;
  readonly returnNumber: string;
  readonly originalReceiptId: string;
  readonly originalReceiptNumber: string;
  readonly salesInvoiceId: string;
  lines: PosReturnLine[];
  readonly refundMethod: PosReturnRefundMethod;
  readonly refundTotal: number;
  salesReturnId?: string;
  salesReturnNumber?: string;
  exchangeId?: string;
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(props: PosReturnProps) {
    if (!props.id?.trim()) throw new Error('PosReturn id is required');
    if (!props.companyId?.trim()) throw new Error('PosReturn companyId is required');
    if (!props.shiftId?.trim()) throw new Error('PosReturn shiftId is required');
    if (!props.registerId?.trim()) throw new Error('PosReturn registerId is required');
    if (!props.returnNumber?.trim()) throw new Error('PosReturn returnNumber is required');
    if (!props.originalReceiptId?.trim()) throw new Error('PosReturn originalReceiptId is required');
    if (!props.salesInvoiceId?.trim()) throw new Error('PosReturn salesInvoiceId is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('PosReturn must have at least one line.');
    }
    const valid: PosReturnRefundMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];
    if (!valid.includes(props.refundMethod)) {
      throw new Error(`PosReturn refundMethod must be one of: ${valid.join(', ')}`);
    }
    this.id = props.id;
    this.companyId = props.companyId;
    this.shiftId = props.shiftId;
    this.registerId = props.registerId;
    this.returnNumber = props.returnNumber;
    this.originalReceiptId = props.originalReceiptId;
    this.originalReceiptNumber = props.originalReceiptNumber;
    this.salesInvoiceId = props.salesInvoiceId;
    this.lines = props.lines;
    this.refundMethod = props.refundMethod;
    this.refundTotal = round2(props.refundTotal);
    this.salesReturnId = props.salesReturnId;
    this.salesReturnNumber = props.salesReturnNumber;
    this.exchangeId = props.exchangeId;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      shiftId: this.shiftId,
      registerId: this.registerId,
      returnNumber: this.returnNumber,
      originalReceiptId: this.originalReceiptId,
      originalReceiptNumber: this.originalReceiptNumber,
      salesInvoiceId: this.salesInvoiceId,
      lines: this.lines,
      refundMethod: this.refundMethod,
      refundTotal: this.refundTotal,
      salesReturnId: this.salesReturnId,
      salesReturnNumber: this.salesReturnNumber,
      exchangeId: this.exchangeId,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosReturn {
    return new PosReturn({
      id: data.id,
      companyId: data.companyId,
      shiftId: data.shiftId,
      registerId: data.registerId,
      returnNumber: data.returnNumber,
      originalReceiptId: data.originalReceiptId,
      originalReceiptNumber: data.originalReceiptNumber,
      salesInvoiceId: data.salesInvoiceId,
      lines: (data.lines || []).map((l: any) => ({
        itemId: l.itemId,
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
        originalLineId: l.originalLineId,
      })),
      refundMethod: data.refundMethod,
      refundTotal: Number(data.refundTotal) || 0,
      salesReturnId: data.salesReturnId,
      salesReturnNumber: data.salesReturnNumber,
      exchangeId: data.exchangeId,
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    });
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
