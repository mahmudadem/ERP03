export type PurchaseRFQStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface PurchaseRFQLine {
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

export interface PurchaseRFQProps {
  id: string;
  companyId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  status: PurchaseRFQStatus;
  version: number;
  originRfqId?: string;
  rfqDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseRFQLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  notes?: string;
  convertedToType?: 'PURCHASE_ORDER' | 'PURCHASE_INVOICE';
  convertedToId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const RFQ_STATUSES: PurchaseRFQStatus[] = [
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

export class PurchaseRFQ {
  readonly id: string;
  readonly companyId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  status: PurchaseRFQStatus;
  version: number;
  originRfqId?: string;
  rfqDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseRFQLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  notes?: string;
  convertedToType?: 'PURCHASE_ORDER' | 'PURCHASE_INVOICE';
  convertedToId?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PurchaseRFQProps) {
    if (!props.id?.trim()) throw new Error('PurchaseRFQ id is required');
    if (!props.companyId?.trim()) throw new Error('PurchaseRFQ companyId is required');
    if (!props.rfqNumber?.trim()) throw new Error('PurchaseRFQ rfqNumber is required');
    if (!props.vendorId?.trim()) throw new Error('PurchaseRFQ vendorId is required');
    if (!props.currency?.trim()) throw new Error('PurchaseRFQ currency is required');
    if (!props.createdBy?.trim()) throw new Error('PurchaseRFQ createdBy is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('PurchaseRFQ must contain at least one line');
    }
    if (props.version < 1 || !Number.isInteger(props.version)) {
      throw new Error('PurchaseRFQ version must be an integer >= 1');
    }
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('PurchaseRFQ exchangeRate must be greater than 0');
    }
    if (props.status && !RFQ_STATUSES.includes(props.status)) {
      throw new Error(`Invalid purchase RFQ status: ${props.status}`);
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.rfqNumber = props.rfqNumber.trim();
    this.vendorId = props.vendorId.trim();
    this.vendorName = props.vendorName || '';
    this.status = props.status || 'DRAFT';
    this.version = props.version;
    this.originRfqId = props.originRfqId;
    this.rfqDate = props.rfqDate;
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

  // State transitions
  markSent(): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot mark purchase RFQ as SENT from status: ${this.status}`);
    }
    this.status = 'SENT';
    this.updatedAt = new Date();
  }

  markAccepted(): void {
    if (this.status !== 'SENT') {
      throw new Error(`Cannot mark purchase RFQ as ACCEPTED from status: ${this.status}`);
    }
    this.status = 'ACCEPTED';
    this.updatedAt = new Date();
  }

  markRejected(): void {
    if (this.status !== 'SENT') {
      throw new Error(`Cannot mark purchase RFQ as REJECTED from status: ${this.status}`);
    }
    this.status = 'REJECTED';
    this.updatedAt = new Date();
  }

  markExpired(): void {
    if (this.status !== 'DRAFT' && this.status !== 'SENT') {
      throw new Error(`Cannot mark purchase RFQ as EXPIRED from status: ${this.status}`);
    }
    this.status = 'EXPIRED';
    this.updatedAt = new Date();
  }

  markConverted(type: 'PURCHASE_ORDER' | 'PURCHASE_INVOICE', id: string): void {
    if (this.status !== 'ACCEPTED') {
      throw new Error(`Cannot mark purchase RFQ as CONVERTED from status: ${this.status}`);
    }
    this.status = 'CONVERTED';
    this.convertedToType = type;
    this.convertedToId = id;
    this.updatedAt = new Date();
  }

  isExpired(today: string): boolean {
    if (!this.validUntil) return false;
    if (this.status !== 'DRAFT' && this.status !== 'SENT') return false;
    return this.validUntil < today;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      rfqNumber: this.rfqNumber,
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      status: this.status,
      version: this.version,
      originRfqId: this.originRfqId,
      rfqDate: this.rfqDate,
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

  static fromJSON(data: any): PurchaseRFQ {
    return new PurchaseRFQ({
      id: data.id,
      companyId: data.companyId,
      rfqNumber: data.rfqNumber,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      status: data.status || 'DRAFT',
      version: data.version ?? 1,
      originRfqId: data.originRfqId,
      rfqDate: data.rfqDate,
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
