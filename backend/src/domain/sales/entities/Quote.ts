import { SalesRuleError } from '../errors/SalesRuleError';

export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface QuoteLine {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  quotedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  grossLineTotalDoc: number;
  discountAmountBase?: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  description?: string;
}

export interface QuoteProps {
  id: string;
  companyId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  status: QuoteStatus;
  version: number;
  originQuoteId?: string;
  quoteDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: QuoteLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  notes?: string;
  convertedToType?: 'SALES_ORDER' | 'SALES_INVOICE';
  convertedToId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const QUOTE_STATUSES: QuoteStatus[] = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED',
];

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class Quote {
  readonly id: string;
  readonly companyId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  status: QuoteStatus;
  version: number;
  originQuoteId?: string;
  quoteDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: QuoteLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  notes?: string;
  convertedToType?: 'SALES_ORDER' | 'SALES_INVOICE';
  convertedToId?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: QuoteProps) {
    if (!props.id?.trim()) throw new Error('Quote id is required');
    if (!props.companyId?.trim()) throw new Error('Quote companyId is required');
    if (!props.quoteNumber?.trim()) throw new Error('Quote quoteNumber is required');
    if (!props.customerId?.trim()) throw new Error('Quote customerId is required');
    if (!props.currency?.trim()) throw new Error('Quote currency is required');
    if (!props.createdBy?.trim()) throw new Error('Quote createdBy is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('Quote must contain at least one line');
    }
    if (props.version < 1 || !Number.isInteger(props.version)) {
      throw new Error('Quote version must be an integer >= 1');
    }
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('Quote exchangeRate must be greater than 0');
    }
    if (props.status && !QUOTE_STATUSES.includes(props.status)) {
      throw new Error(`Invalid quote status: ${props.status}`);
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.quoteNumber = props.quoteNumber.trim();
    this.customerId = props.customerId.trim();
    this.customerName = props.customerName || '';
    this.salespersonId = props.salespersonId;
    this.status = props.status || 'DRAFT';
    this.version = props.version;
    this.originQuoteId = props.originQuoteId;
    this.quoteDate = props.quoteDate;
    this.validUntil = props.validUntil;
    this.currency = props.currency.toUpperCase().trim();
    this.exchangeRate = props.exchangeRate;
    this.lines = props.lines.map((l) => ({ ...l }));
    this.subtotalDoc = props.subtotalDoc;
    this.taxTotalDoc = props.taxTotalDoc;
    this.grandTotalDoc = props.grandTotalDoc;
    this.subtotalBase = props.subtotalBase;
    this.taxTotalBase = props.taxTotalBase;
    this.grandTotalBase = props.grandTotalBase;
    this.notes = props.notes;
    this.convertedToType = props.convertedToType;
    this.convertedToId = props.convertedToId;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  markSent(): void {
    if (this.status !== 'DRAFT') {
      throw new SalesRuleError('QUOTE_INVALID_STATE', `Cannot mark quote as SENT from status: ${this.status}`, {
        fieldHints: ['status'],
      });
    }
    this.status = 'SENT';
    this.updatedAt = new Date();
  }

  markAccepted(): void {
    if (this.status !== 'SENT') {
      throw new SalesRuleError('QUOTE_INVALID_STATE', `Cannot mark quote as ACCEPTED from status: ${this.status}`, {
        fieldHints: ['status'],
      });
    }
    this.status = 'ACCEPTED';
    this.updatedAt = new Date();
  }

  markRejected(): void {
    if (this.status !== 'SENT') {
      throw new SalesRuleError('QUOTE_INVALID_STATE', `Cannot mark quote as REJECTED from status: ${this.status}`, {
        fieldHints: ['status'],
      });
    }
    this.status = 'REJECTED';
    this.updatedAt = new Date();
  }

  markExpired(): void {
    if (this.status !== 'DRAFT' && this.status !== 'SENT') {
      throw new SalesRuleError('QUOTE_INVALID_STATE', `Cannot mark quote as EXPIRED from status: ${this.status}`, {
        fieldHints: ['status'],
      });
    }
    this.status = 'EXPIRED';
    this.updatedAt = new Date();
  }

  markConverted(type: 'SALES_ORDER' | 'SALES_INVOICE', id: string): void {
    if (this.status !== 'ACCEPTED') {
      throw new SalesRuleError('QUOTE_INVALID_STATE', `Cannot mark quote as CONVERTED from status: ${this.status}`, {
        fieldHints: ['status'],
      });
    }
    this.status = 'CONVERTED';
    this.convertedToType = type;
    this.convertedToId = id;
    this.updatedAt = new Date();
  }

  /**
   * Returns true when validUntil is set, is strictly before today, and status
   * is still DRAFT or SENT (i.e. the offer could logically still be active).
   */
  isExpired(today: string): boolean {
    if (!this.validUntil) return false;
    if (this.status !== 'DRAFT' && this.status !== 'SENT') return false;
    return this.validUntil < today;
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      quoteNumber: this.quoteNumber,
      customerId: this.customerId,
      customerName: this.customerName,
      salespersonId: this.salespersonId,
      status: this.status,
      version: this.version,
      originQuoteId: this.originQuoteId,
      quoteDate: this.quoteDate,
      validUntil: this.validUntil,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((l) => ({ ...l })),
      subtotalDoc: this.subtotalDoc,
      taxTotalDoc: this.taxTotalDoc,
      grandTotalDoc: this.grandTotalDoc,
      subtotalBase: this.subtotalBase,
      taxTotalBase: this.taxTotalBase,
      grandTotalBase: this.grandTotalBase,
      notes: this.notes,
      convertedToType: this.convertedToType,
      convertedToId: this.convertedToId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): Quote {
    return new Quote({
      id: data.id,
      companyId: data.companyId,
      quoteNumber: data.quoteNumber,
      customerId: data.customerId,
      customerName: data.customerName || '',
      salespersonId: data.salespersonId,
      status: data.status || 'DRAFT',
      version: data.version ?? 1,
      originQuoteId: data.originQuoteId,
      quoteDate: data.quoteDate,
      validUntil: data.validUntil,
      currency: data.currency,
      exchangeRate: data.exchangeRate ?? 1,
      lines: data.lines || [],
      subtotalDoc: data.subtotalDoc ?? 0,
      taxTotalDoc: data.taxTotalDoc ?? 0,
      grandTotalDoc: data.grandTotalDoc ?? 0,
      subtotalBase: data.subtotalBase ?? 0,
      taxTotalBase: data.taxTotalBase ?? 0,
      grandTotalBase: data.grandTotalBase ?? 0,
      notes: data.notes,
      convertedToType: data.convertedToType,
      convertedToId: data.convertedToId,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  }
}
