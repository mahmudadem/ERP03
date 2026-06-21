import { roundMoney } from '../../../application/system-core/money/roundMoney';
export type SRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT';
export type ReturnSettlementMode = 'CREDIT_NOTE' | 'REFUND';
export type ReturnReasonCode = 'DEFECTIVE' | 'WRONG_ITEM' | 'CHANGED_MIND' | 'OTHER';
export type RestockingFeeType = 'PERCENT' | 'AMOUNT';
export type SalesReturnDiscountType = 'PERCENT' | 'AMOUNT';

export interface SalesReturnLine {
  lineId: string;
  lineNo: number;
  siLineId?: string;
  dnLineId?: string;
  soLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  returnQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc?: number;
  grossLineTotalDoc?: number;
  discountType?: SalesReturnDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
  unitPriceBase?: number;
  grossLineTotalBase?: number;
  discountAmountBase?: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxRate: number;
  // When true, `unitPriceDoc` already includes tax. Same shape as the SI fix
  // (Task 168), SO fix (Task 170B), and PI fix (Task 170A). The entity splits
  // gross into net + tax so subtotal/tax/grand sum correctly.
  priceIsInclusive?: boolean;
  taxAmountDoc: number;
  taxAmountBase: number;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface SalesReturnProps {
  id: string;
  companyId: string;
  returnNumber: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  returnContext: ReturnContext;
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: SalesReturnLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  netSettlementAmountDoc?: number;
  netSettlementAmountBase?: number;
  settlementMode?: ReturnSettlementMode;
  reasonCode?: ReturnReasonCode;
  reason: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue?: number;
  restockingFeeAmountDoc?: number;
  restockingFeeAmountBase?: number;
  refundSettlementAccountId?: string;
  notes?: string;
  status?: SRStatus;
  revenueVoucherId?: string | null;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
}

const SR_STATUSES: SRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const RETURN_CONTEXTS: ReturnContext[] = ['AFTER_INVOICE', 'BEFORE_INVOICE', 'DIRECT'];
const RETURN_SETTLEMENT_MODES: ReturnSettlementMode[] = ['CREDIT_NOTE', 'REFUND'];
const RETURN_REASON_CODES: ReturnReasonCode[] = ['DEFECTIVE', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER'];
const RESTOCKING_FEE_TYPES: RestockingFeeType[] = ['PERCENT', 'AMOUNT'];
const SR_DISCOUNT_TYPES: SalesReturnDiscountType[] = ['PERCENT', 'AMOUNT'];

const normalizeSRDiscountType = (value: any): SalesReturnDiscountType | undefined => {
  if (value === null || value === undefined) return undefined;
  const token = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SR_DISCOUNT_TYPES.includes(token as SalesReturnDiscountType)
    ? (token as SalesReturnDiscountType)
    : undefined;
};

const calculateSRDiscountAmountDoc = (
  grossLineTotalDoc: number,
  discountType: SalesReturnDiscountType | undefined,
  discountValue: number,
  explicitDiscountAmountDoc: number | undefined,
): number => {
  if (explicitDiscountAmountDoc !== undefined && !Number.isNaN(explicitDiscountAmountDoc)) {
    return roundMoney(Math.max(0, Math.min(explicitDiscountAmountDoc, grossLineTotalDoc)));
  }
  if (discountType === 'PERCENT') {
    return roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))));
  }
  if (discountType === 'AMOUNT') {
    return roundMoney(Math.max(0, Math.min(discountValue, grossLineTotalDoc)));
  }
  return 0;
};

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class SalesReturn {
  readonly id: string;
  readonly companyId: string;
  returnNumber: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  returnContext: ReturnContext;
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: SalesReturnLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  netSettlementAmountDoc: number;
  netSettlementAmountBase: number;
  settlementMode: ReturnSettlementMode;
  reasonCode: ReturnReasonCode;
  reason: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue: number;
  restockingFeeAmountDoc: number;
  restockingFeeAmountBase: number;
  refundSettlementAccountId?: string;
  notes?: string;
  status: SRStatus;
  revenueVoucherId?: string | null;
  cogsVoucherId?: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;

  constructor(props: SalesReturnProps) {
    if (!props.id?.trim()) throw new Error('SalesReturn id is required');
    if (!props.companyId?.trim()) throw new Error('SalesReturn companyId is required');
    if (!props.returnNumber?.trim()) throw new Error('SalesReturn returnNumber is required');
    if (!props.customerId?.trim()) throw new Error('SalesReturn customerId is required');
    if (!props.returnDate?.trim()) throw new Error('SalesReturn returnDate is required');
    if (!props.warehouseId?.trim()) throw new Error('SalesReturn warehouseId is required');
    if (!props.currency?.trim()) throw new Error('SalesReturn currency is required');
    if (!props.reason?.trim()) throw new Error('SalesReturn reason is required');
    if (!props.createdBy?.trim()) throw new Error('SalesReturn createdBy is required');
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('SalesReturn exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('SalesReturn must contain at least one line');
    }
    if (!RETURN_CONTEXTS.includes(props.returnContext)) {
      throw new Error(`Invalid returnContext: ${props.returnContext}`);
    }
    const settlementMode = props.settlementMode || 'CREDIT_NOTE';
    if (!RETURN_SETTLEMENT_MODES.includes(settlementMode)) {
      throw new Error(`Invalid settlementMode: ${settlementMode}`);
    }
    const reasonCode = props.reasonCode || 'OTHER';
    if (!RETURN_REASON_CODES.includes(reasonCode)) {
      throw new Error(`Invalid reasonCode: ${reasonCode}`);
    }

    const restockingFeeType = props.restockingFeeType || ((props.restockingFeeValue || 0) > 0 ? 'AMOUNT' : undefined);
    if (restockingFeeType && !RESTOCKING_FEE_TYPES.includes(restockingFeeType)) {
      throw new Error(`Invalid restockingFeeType: ${restockingFeeType}`);
    }

    const restockingFeeValue = roundMoney(props.restockingFeeValue || 0);
    if (restockingFeeValue < 0 || Number.isNaN(restockingFeeValue)) {
      throw new Error('SalesReturn restockingFeeValue must be greater than or equal to 0');
    }
    if (restockingFeeType === 'PERCENT' && restockingFeeValue > 100) {
      throw new Error('SalesReturn restockingFeeValue cannot exceed 100 for PERCENT type');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.returnNumber = props.returnNumber.trim();
    this.salesInvoiceId = props.salesInvoiceId;
    this.deliveryNoteId = props.deliveryNoteId;
    this.salesOrderId = props.salesOrderId;
    this.customerId = props.customerId.trim();
    this.customerName = props.customerName || '';
    this.returnContext = props.returnContext;
    this.returnDate = props.returnDate;
    this.warehouseId = props.warehouseId.trim();
    this.currency = props.currency.toUpperCase().trim();
    this.exchangeRate = props.exchangeRate;
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));

    this.subtotalDoc = roundMoney(
      this.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * (line.unitPriceDoc ?? 0)), 0)
    );
    this.subtotalBase = roundMoney(
      this.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * (line.unitPriceBase ?? 0)), 0)
    );
    this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);
    this.settlementMode = settlementMode;
    this.reasonCode = reasonCode;
    this.restockingFeeType = restockingFeeType;
    this.restockingFeeValue = restockingFeeValue;
    this.restockingFeeAmountDoc = 0;
    this.restockingFeeAmountBase = 0;
    this.netSettlementAmountDoc = this.grandTotalDoc;
    this.netSettlementAmountBase = this.grandTotalBase;
    this.recalculateMonetaryTotals();

    const status = props.status || 'DRAFT';
    if (!SR_STATUSES.includes(status)) {
      throw new Error(`Invalid sales return status: ${status}`);
    }
    this.status = status;

    this.reason = props.reason.trim();
    this.notes = props.notes;
    this.refundSettlementAccountId = props.refundSettlementAccountId?.trim() || undefined;
    this.revenueVoucherId = props.revenueVoucherId ?? null;
    this.cogsVoucherId = props.cogsVoucherId ?? null;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
  }

  private normalizeLine(line: SalesReturnLine, index: number): SalesReturnLine {
    if (!line.lineId?.trim()) throw new Error(`SalesReturn line ${index + 1}: lineId is required`);
    if (!line.itemId?.trim()) throw new Error(`SalesReturn line ${index + 1}: itemId is required`);
    if (line.returnQty <= 0 || Number.isNaN(line.returnQty)) {
      throw new Error(`SalesReturn line ${index + 1}: returnQty must be greater than 0`);
    }
    if (!line.uom?.trim()) throw new Error(`SalesReturn line ${index + 1}: uom is required`);

    const taxRate = Number.isNaN(line.taxRate) ? 0 : line.taxRate;
    const priceIsInclusive = line.priceIsInclusive === true;
    const discountType = normalizeSRDiscountType(line.discountType);
    const discountValueRaw = Number(line.discountValue);
    const discountValue = Number.isNaN(discountValueRaw) ? 0 : discountValueRaw;
    const explicitDiscountDoc =
      line.discountAmountDoc !== undefined ? Number(line.discountAmountDoc) : undefined;
    const grossLineTotalDoc = roundMoney(line.returnQty * (line.unitPriceDoc ?? 0));
    const grossLineTotalBase = roundMoney(line.returnQty * (line.unitPriceBase ?? 0));
    const discountAmountDoc = calculateSRDiscountAmountDoc(
      grossLineTotalDoc,
      discountType,
      discountValue,
      explicitDiscountDoc,
    );
    const discountAmountBase = roundMoney(discountAmountDoc * (line.fxRateCCYToBase || 1));
    const postDiscountDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
    const postDiscountBase = roundMoney(grossLineTotalBase - discountAmountBase);
    const divisor = priceIsInclusive ? 1 + taxRate : 1;
    const netLineTotalDoc = roundMoney(postDiscountDoc / divisor);
    const netLineTotalBase = roundMoney(postDiscountBase / divisor);
    const defaultTaxAmountDoc = priceIsInclusive
      ? roundMoney(postDiscountDoc - netLineTotalDoc)
      : roundMoney(netLineTotalDoc * taxRate);
    const defaultTaxAmountBase = priceIsInclusive
      ? roundMoney(postDiscountBase - netLineTotalBase)
      : roundMoney(netLineTotalBase * taxRate);

    return {
      lineId: line.lineId,
      lineNo: line.lineNo || index + 1,
      siLineId: line.siLineId,
      dnLineId: line.dnLineId,
      soLineId: line.soLineId,
      itemId: line.itemId,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      returnQty: line.returnQty,
      uomId: line.uomId,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      grossLineTotalDoc,
      discountType,
      discountValue: discountType ? discountValue : undefined,
      discountAmountDoc,
      unitPriceBase: line.unitPriceBase,
      grossLineTotalBase,
      discountAmountBase,
      unitCostBase: roundMoney(line.unitCostBase || 0),
      fxRateMovToBase: line.fxRateMovToBase || 1,
      fxRateCCYToBase: line.fxRateCCYToBase || 1,
      taxCodeId: line.taxCodeId,
      taxRate,
      priceIsInclusive,
      taxAmountDoc: roundMoney(line.taxAmountDoc ?? defaultTaxAmountDoc),
      taxAmountBase: roundMoney(line.taxAmountBase ?? defaultTaxAmountBase),
      revenueAccountId: line.revenueAccountId,
      cogsAccountId: line.cogsAccountId,
      inventoryAccountId: line.inventoryAccountId,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  recalculateMonetaryTotals(): void {
    // Subtotal is NET. For inclusive lines we strip tax out of (qty * unitPrice)
    // using the divisor so subtotal + tax = grand stays consistent with how the
    // user-entered gross was already split inside the line.
    const netDoc = (line: SalesReturnLine): number => {
      const gross = roundMoney(line.returnQty * (line.unitPriceDoc ?? 0));
      const postDisc = roundMoney(gross - (line.discountAmountDoc ?? 0));
      const divisor = line.priceIsInclusive ? 1 + (line.taxRate || 0) : 1;
      return roundMoney(postDisc / divisor);
    };
    const netBase = (line: SalesReturnLine): number => {
      const gross = roundMoney(line.returnQty * (line.unitPriceBase ?? 0));
      const postDisc = roundMoney(gross - (line.discountAmountBase ?? 0));
      const divisor = line.priceIsInclusive ? 1 + (line.taxRate || 0) : 1;
      return roundMoney(postDisc / divisor);
    };

    this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + netDoc(line), 0));
    this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + netBase(line), 0));
    this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);

    const feeValue = roundMoney(this.restockingFeeValue || 0);
    if (!this.restockingFeeType || feeValue <= 0) {
      this.restockingFeeAmountDoc = 0;
      this.restockingFeeAmountBase = 0;
      this.netSettlementAmountDoc = this.grandTotalDoc;
      this.netSettlementAmountBase = this.grandTotalBase;
      return;
    }

    const computedFeeDoc = this.restockingFeeType === 'PERCENT'
      ? roundMoney((this.grandTotalDoc * feeValue) / 100)
      : roundMoney(feeValue);
    const computedFeeBase = this.restockingFeeType === 'PERCENT'
      ? roundMoney((this.grandTotalBase * feeValue) / 100)
      : roundMoney(feeValue * this.exchangeRate);

    if (computedFeeDoc > this.grandTotalDoc + 0.0001 || computedFeeBase > this.grandTotalBase + 0.0001) {
      throw new Error('SalesReturn restocking fee cannot exceed return grand total');
    }

    this.restockingFeeAmountDoc = computedFeeDoc;
    this.restockingFeeAmountBase = computedFeeBase;
    this.netSettlementAmountDoc = roundMoney(this.grandTotalDoc - computedFeeDoc);
    this.netSettlementAmountBase = roundMoney(this.grandTotalBase - computedFeeBase);
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      returnNumber: this.returnNumber,
      salesInvoiceId: this.salesInvoiceId,
      deliveryNoteId: this.deliveryNoteId,
      salesOrderId: this.salesOrderId,
      customerId: this.customerId,
      customerName: this.customerName,
      returnContext: this.returnContext,
      returnDate: this.returnDate,
      warehouseId: this.warehouseId,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((line) => ({ ...line })),
      subtotalDoc: this.subtotalDoc,
      taxTotalDoc: this.taxTotalDoc,
      grandTotalDoc: this.grandTotalDoc,
      subtotalBase: this.subtotalBase,
      taxTotalBase: this.taxTotalBase,
      grandTotalBase: this.grandTotalBase,
      netSettlementAmountDoc: this.netSettlementAmountDoc,
      netSettlementAmountBase: this.netSettlementAmountBase,
      settlementMode: this.settlementMode,
      reasonCode: this.reasonCode,
      reason: this.reason,
      restockingFeeType: this.restockingFeeType,
      restockingFeeValue: this.restockingFeeValue,
      restockingFeeAmountDoc: this.restockingFeeAmountDoc,
      restockingFeeAmountBase: this.restockingFeeAmountBase,
      refundSettlementAccountId: this.refundSettlementAccountId,
      notes: this.notes,
      status: this.status,
      revenueVoucherId: this.revenueVoucherId ?? null,
      cogsVoucherId: this.cogsVoucherId ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): SalesReturn {
    return new SalesReturn({
      id: data.id,
      companyId: data.companyId,
      returnNumber: data.returnNumber,
      salesInvoiceId: data.salesInvoiceId,
      deliveryNoteId: data.deliveryNoteId,
      salesOrderId: data.salesOrderId,
      customerId: data.customerId,
      customerName: data.customerName,
      returnContext: data.returnContext,
      returnDate: data.returnDate,
      warehouseId: data.warehouseId,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      subtotalDoc: data.subtotalDoc ?? 0,
      taxTotalDoc: data.taxTotalDoc ?? 0,
      grandTotalDoc: data.grandTotalDoc ?? 0,
      subtotalBase: data.subtotalBase ?? 0,
      taxTotalBase: data.taxTotalBase ?? 0,
      grandTotalBase: data.grandTotalBase ?? 0,
      netSettlementAmountDoc: data.netSettlementAmountDoc ?? 0,
      netSettlementAmountBase: data.netSettlementAmountBase ?? 0,
      settlementMode: data.settlementMode,
      reasonCode: data.reasonCode,
      reason: data.reason,
      restockingFeeType: data.restockingFeeType,
      restockingFeeValue: data.restockingFeeValue ?? 0,
      restockingFeeAmountDoc: data.restockingFeeAmountDoc ?? 0,
      restockingFeeAmountBase: data.restockingFeeAmountBase ?? 0,
      refundSettlementAccountId: data.refundSettlementAccountId,
      notes: data.notes,
      status: data.status || 'DRAFT',
      revenueVoucherId: data.revenueVoucherId ?? null,
      cogsVoucherId: data.cogsVoucherId ?? null,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
    });
  }
}
