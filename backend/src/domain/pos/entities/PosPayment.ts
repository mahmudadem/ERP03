/**
 * PosPayment — One tender row in a POS receipt.
 * Mirrors the SI's settlement rows but lives in POS for quick lookups + printing.
 */
export type PosPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';

export interface PosPaymentProps {
  id: string;
  companyId: string;
  receiptId: string;
  method: PosPaymentMethod;
  amount: number;
  changeGiven: number;
  reference?: string;
  createdAt: Date;
}

export class PosPayment {
  readonly id: string;
  readonly companyId: string;
  readonly receiptId: string;
  readonly method: PosPaymentMethod;
  readonly amount: number;
  readonly changeGiven: number;
  readonly reference?: string;
  readonly createdAt: Date;

  constructor(props: PosPaymentProps) {
    if (!props.id?.trim()) throw new Error('PosPayment id is required');
    if (!props.companyId?.trim()) throw new Error('PosPayment companyId is required');
    if (!props.receiptId?.trim()) throw new Error('PosPayment receiptId is required');
    const valid: PosPaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];
    if (!valid.includes(props.method)) {
      throw new Error(`PosPayment method must be one of: ${valid.join(', ')}`);
    }
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new Error('PosPayment amount must be > 0');
    }
    if (!Number.isFinite(props.changeGiven) || props.changeGiven < 0) {
      throw new Error('PosPayment changeGiven must be >= 0');
    }
    this.id = props.id;
    this.companyId = props.companyId;
    this.receiptId = props.receiptId;
    this.method = props.method;
    this.amount = round2(props.amount);
    this.changeGiven = round2(props.changeGiven);
    this.reference = props.reference?.trim() || undefined;
    this.createdAt = props.createdAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      receiptId: this.receiptId,
      method: this.method,
      amount: this.amount,
      changeGiven: this.changeGiven,
      reference: this.reference,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosPayment {
    return new PosPayment({
      id: data.id,
      companyId: data.companyId,
      receiptId: data.receiptId,
      method: data.method,
      amount: Number(data.amount) || 0,
      changeGiven: Number(data.changeGiven) || 0,
      reference: data.reference,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    });
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
