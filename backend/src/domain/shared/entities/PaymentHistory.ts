import { roundMoney } from '../../../application/system-core/money/roundMoney';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
export type PaymentSourceType = 'SALES_INVOICE' | 'PURCHASE_INVOICE';

export interface PaymentHistoryProps {
  id: string;
  companyId: string;
  sourceType: PaymentSourceType;
  sourceId: string;
  sourceNumber: string;
  amountBase: number;
  currency: string;
  exchangeRate: number;
  amountDoc: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  voucherId?: string | null;
  createdBy: string;
  createdAt: Date;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const SOURCE_TYPES: PaymentSourceType[] = ['SALES_INVOICE', 'PURCHASE_INVOICE'];


const toDate = (value: unknown): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(String(value));
};

const toStr = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['id', 'value', 'code', 'key', 'uid', 'uuid']) {
      const c = obj[key];
      if (c !== undefined && c !== null && c !== '') return String(c).trim();
    }
    return '';
  }
  return String(value).trim();
};

export class PaymentHistory {
  readonly id: string;
  readonly companyId: string;
  readonly sourceType: PaymentSourceType;
  readonly sourceId: string;
  readonly sourceNumber: string;
  readonly amountBase: number;
  readonly currency: string;
  readonly exchangeRate: number;
  readonly amountDoc: number;
  readonly paymentDate: string;
  readonly paymentMethod: PaymentMethod;
  readonly reference?: string;
  readonly notes?: string;
  readonly voucherId?: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(props: PaymentHistoryProps) {
    const id = toStr(props.id);
    const companyId = toStr(props.companyId);
    const sourceType = toStr(props.sourceType) as PaymentSourceType;
    const sourceId = toStr(props.sourceId);
    const sourceNumber = toStr(props.sourceNumber);
    const currency = toStr(props.currency);
    const createdBy = toStr(props.createdBy);
    const paymentMethod = toStr(props.paymentMethod) as PaymentMethod;
    const paymentDate = toStr(props.paymentDate);

    if (!id) throw new Error('PaymentHistory id is required');
    if (!companyId) throw new Error('PaymentHistory companyId is required');
    if (!SOURCE_TYPES.includes(sourceType)) throw new Error(`Invalid PaymentHistory sourceType: ${sourceType}`);
    if (!sourceId) throw new Error('PaymentHistory sourceId is required');
    if (!sourceNumber) throw new Error('PaymentHistory sourceNumber is required');
    if (!currency) throw new Error('PaymentHistory currency is required');
    if (!createdBy) throw new Error('PaymentHistory createdBy is required');
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error(`Invalid PaymentHistory paymentMethod: ${paymentMethod}`);
    if (!paymentDate) throw new Error('PaymentHistory paymentDate is required');

    const amountBase = Number(props.amountBase);
    const amountDoc = Number(props.amountDoc ?? props.amountBase);
    const exchangeRate = Number(props.exchangeRate ?? 1);

    if (amountBase <= 0 || Number.isNaN(amountBase)) throw new Error('PaymentHistory amountBase must be positive');
    if (exchangeRate <= 0 || Number.isNaN(exchangeRate)) throw new Error('PaymentHistory exchangeRate must be > 0');

    this.id = id;
    this.companyId = companyId;
    this.sourceType = sourceType;
    this.sourceId = sourceId;
    this.sourceNumber = sourceNumber;
    this.amountBase = roundMoney(amountBase);
    this.currency = currency.toUpperCase();
    this.exchangeRate = exchangeRate;
    this.amountDoc = roundMoney(amountDoc);
    this.paymentDate = paymentDate;
    this.paymentMethod = paymentMethod;
    this.reference = props.reference || undefined;
    this.notes = props.notes || undefined;
    this.voucherId = props.voucherId ?? null;
    this.createdBy = createdBy;
    this.createdAt = props.createdAt;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceNumber: this.sourceNumber,
      amountBase: this.amountBase,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      amountDoc: this.amountDoc,
      paymentDate: this.paymentDate,
      paymentMethod: this.paymentMethod,
      reference: this.reference ?? null,
      notes: this.notes ?? null,
      voucherId: this.voucherId ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data: Record<string, unknown>): PaymentHistory {
    return new PaymentHistory({
      id: data.id as string,
      companyId: data.companyId as string,
      sourceType: data.sourceType as PaymentSourceType,
      sourceId: data.sourceId as string,
      sourceNumber: data.sourceNumber as string,
      amountBase: Number(data.amountBase),
      currency: data.currency as string,
      exchangeRate: Number(data.exchangeRate ?? 1),
      amountDoc: Number(data.amountDoc ?? data.amountBase),
      paymentDate: data.paymentDate as string,
      paymentMethod: data.paymentMethod as PaymentMethod,
      reference: (data.reference as string) || undefined,
      notes: (data.notes as string) || undefined,
      voucherId: (data.voucherId as string) ?? null,
      createdBy: data.createdBy as string,
      createdAt: toDate(data.createdAt),
    });
  }
}
