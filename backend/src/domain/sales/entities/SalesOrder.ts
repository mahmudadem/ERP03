import { roundMoney } from '../../../application/system-core/money/roundMoney';
import { resolveLineDiscountAmount } from '../../../application/system-core/commercial/CommercialCore';
export type SOStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_DELIVERED'
  | 'FULLY_DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';

export type SOItemType = 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
export type SalesOrderDiscountType = 'PERCENT' | 'AMOUNT';

import { AppliedPromotionInfo } from './AppliedPromotion';

export interface SalesOrderLine {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: SOItemType;
  trackInventory: boolean;
  orderedQty: number;
  uomId?: string;
  uom: string;
  deliveredQty: number;
  invoicedQty: number;
  returnedQty: number;
  unitPriceDoc: number;
  grossLineTotalDoc?: number;
  discountType?: SalesOrderDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  grossLineTotalBase?: number;
  discountAmountBase?: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxRate: number;
  // When true, `unitPriceDoc` already includes tax. The entity derives net
  // (lineTotalDoc) and tax (taxAmountDoc) by splitting the gross — same shape
  // as the SI fix (Task 168).
  priceIsInclusive?: boolean;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  description?: string;
  appliedPromotionId?: string;
  appliedPromotionName?: string;
  appliedDiscountPct?: number;
}

export interface SalesOrderProps {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLine[];
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  status: SOStatus;
  notes?: string;
  internalNotes?: string;
  promisedDate?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  closedAt?: Date;
  appliedPromotions?: AppliedPromotionInfo[];
}

const SO_STATUSES: SOStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];
const SO_DISCOUNT_TYPES: SalesOrderDiscountType[] = ['PERCENT', 'AMOUNT'];


const normalizeSODiscountType = (value: any): SalesOrderDiscountType | undefined => {
  if (value === null || value === undefined) return undefined;
  const token = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SO_DISCOUNT_TYPES.includes(token as SalesOrderDiscountType)
    ? (token as SalesOrderDiscountType)
    : undefined;
};

const calculateSODiscountAmountDoc = (
  grossLineTotalDoc: number,
  discountType: SalesOrderDiscountType | undefined,
  discountValue: number,
  explicitDiscountAmountDoc: number | undefined,
): number => {
  return resolveLineDiscountAmount(grossLineTotalDoc, {
    discountType,
    discountValue,
    explicitDiscountAmount: explicitDiscountAmountDoc,
  });
};

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class SalesOrder {
  readonly id: string;
  readonly companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLine[];
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  status: SOStatus;
  notes?: string;
  internalNotes?: string;
  promisedDate?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  closedAt?: Date;
  appliedPromotions?: AppliedPromotionInfo[];

  constructor(props: SalesOrderProps) {
    if (!props.id?.trim()) throw new Error('SalesOrder id is required');
    if (!props.companyId?.trim()) throw new Error('SalesOrder companyId is required');
    if (!props.orderNumber?.trim()) throw new Error('SalesOrder orderNumber is required');
    if (!props.customerId?.trim()) throw new Error('SalesOrder customerId is required');
    if (!props.currency?.trim()) throw new Error('SalesOrder currency is required');
    if (!props.createdBy?.trim()) throw new Error('SalesOrder createdBy is required');
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('SalesOrder exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('SalesOrder must contain at least one line');
    }
    if (props.status && !SO_STATUSES.includes(props.status)) {
      throw new Error(`Invalid sales order status: ${props.status}`);
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.orderNumber = props.orderNumber.trim();
    this.customerId = props.customerId.trim();
    this.customerName = props.customerName || '';
    this.salespersonId = props.salespersonId;
    this.orderDate = props.orderDate;
    this.expectedDeliveryDate = props.expectedDeliveryDate;
    this.currency = props.currency.toUpperCase().trim();
    this.exchangeRate = props.exchangeRate;
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));

    this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);

    this.status = props.status || 'DRAFT';
    this.notes = props.notes;
    this.internalNotes = props.internalNotes;
    this.promisedDate = props.promisedDate;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.confirmedAt = props.confirmedAt;
    this.closedAt = props.closedAt;
    this.appliedPromotions = props.appliedPromotions;
  }

  private normalizeLine(line: SalesOrderLine, index: number): SalesOrderLine {
    if (!line.itemId?.trim()) throw new Error(`SalesOrder line ${index + 1}: itemId is required`);
    if (line.orderedQty <= 0 || Number.isNaN(line.orderedQty)) {
      throw new Error(`SalesOrder line ${index + 1}: orderedQty must be greater than 0`);
    }
    if (line.unitPriceDoc < 0 || Number.isNaN(line.unitPriceDoc)) {
      throw new Error(`SalesOrder line ${index + 1}: unitPriceDoc must be greater than or equal to 0`);
    }
    if (!line.uom?.trim()) {
      throw new Error(`SalesOrder line ${index + 1}: uom is required`);
    }

    const normalizedTaxRate = line.taxRate ?? 0;
    const priceIsInclusive = line.priceIsInclusive === true;
    const discountType = normalizeSODiscountType(line.discountType);
    const discountValueRaw = Number(line.discountValue);
    const discountValue = Number.isNaN(discountValueRaw) ? 0 : discountValueRaw;
    const explicitDiscountDoc =
      line.discountAmountDoc !== undefined ? Number(line.discountAmountDoc) : undefined;

    const grossLineTotalDoc = roundMoney(line.orderedQty * line.unitPriceDoc);
    const discountAmountDoc = calculateSODiscountAmountDoc(
      grossLineTotalDoc,
      discountType,
      discountValue,
      explicitDiscountDoc,
    );
    const postDiscountDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
    const divisor = priceIsInclusive ? 1 + normalizedTaxRate : 1;
    const lineTotalDoc = roundMoney(postDiscountDoc / divisor);
    const unitPriceBase = roundMoney(line.unitPriceDoc * this.exchangeRate);
    const grossLineTotalBase = roundMoney(grossLineTotalDoc * this.exchangeRate);
    const discountAmountBase = roundMoney(discountAmountDoc * this.exchangeRate);
    const lineTotalBase = roundMoney(lineTotalDoc * this.exchangeRate);
    const taxAmountDoc = priceIsInclusive
      ? roundMoney(postDiscountDoc - lineTotalDoc)
      : roundMoney(lineTotalDoc * normalizedTaxRate);
    const taxAmountBase = roundMoney(taxAmountDoc * this.exchangeRate);

    return {
      lineId: line.lineId,
      lineNo: line.lineNo ?? index + 1,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      itemType: line.itemType,
      trackInventory: line.trackInventory,
      orderedQty: line.orderedQty,
      uomId: line.uomId,
      uom: line.uom,
      deliveredQty: line.deliveredQty ?? 0,
      invoicedQty: line.invoicedQty ?? 0,
      returnedQty: line.returnedQty ?? 0,
      unitPriceDoc: line.unitPriceDoc,
      grossLineTotalDoc,
      discountType,
      discountValue: discountType ? discountValue : undefined,
      discountAmountDoc,
      grossLineTotalBase,
      discountAmountBase,
      lineTotalDoc,
      unitPriceBase,
      lineTotalBase,
      taxCodeId: line.taxCodeId,
      taxRate: normalizedTaxRate,
      priceIsInclusive,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: line.warehouseId,
      description: line.description,
      appliedPromotionId: line.appliedPromotionId,
      appliedPromotionName: line.appliedPromotionName,
      appliedDiscountPct: line.appliedDiscountPct,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      customerName: this.customerName,
      salespersonId: this.salespersonId,
      orderDate: this.orderDate,
      expectedDeliveryDate: this.expectedDeliveryDate,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((line) => ({ ...line })),
      subtotalBase: this.subtotalBase,
      taxTotalBase: this.taxTotalBase,
      grandTotalBase: this.grandTotalBase,
      subtotalDoc: this.subtotalDoc,
      taxTotalDoc: this.taxTotalDoc,
      grandTotalDoc: this.grandTotalDoc,
      status: this.status,
      notes: this.notes,
      internalNotes: this.internalNotes,
      promisedDate: this.promisedDate,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      confirmedAt: this.confirmedAt,
      closedAt: this.closedAt,
      appliedPromotions: this.appliedPromotions,
    };
  }

  static fromJSON(data: any): SalesOrder {
    return new SalesOrder({
      id: data.id,
      companyId: data.companyId,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      salespersonId: data.salespersonId,
      orderDate: data.orderDate,
      expectedDeliveryDate: data.expectedDeliveryDate,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      subtotalBase: data.subtotalBase ?? 0,
      taxTotalBase: data.taxTotalBase ?? 0,
      grandTotalBase: data.grandTotalBase ?? 0,
      subtotalDoc: data.subtotalDoc ?? 0,
      taxTotalDoc: data.taxTotalDoc ?? 0,
      grandTotalDoc: data.grandTotalDoc ?? 0,
      status: data.status || 'DRAFT',
      notes: data.notes,
      internalNotes: data.internalNotes,
      promisedDate: data.promisedDate,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      confirmedAt: data.confirmedAt ? toDate(data.confirmedAt) : undefined,
      closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
      appliedPromotions: data.appliedPromotions,
    });
  }
}
