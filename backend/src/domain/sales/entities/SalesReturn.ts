export type SRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';

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
  unitPriceBase?: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxRate: number;
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
  reason: string;
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
const RETURN_CONTEXTS: ReturnContext[] = ['AFTER_INVOICE', 'BEFORE_INVOICE'];
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

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
  reason: string;
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

    const status = props.status || 'DRAFT';
    if (!SR_STATUSES.includes(status)) {
      throw new Error(`Invalid sales return status: ${status}`);
    }
    this.status = status;

    this.reason = props.reason.trim();
    this.notes = props.notes;
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
    const lineTotalDoc = roundMoney(line.returnQty * (line.unitPriceDoc ?? 0));
    const lineTotalBase = roundMoney(line.returnQty * (line.unitPriceBase ?? 0));

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
      unitPriceBase: line.unitPriceBase,
      unitCostBase: roundMoney(line.unitCostBase || 0),
      fxRateMovToBase: line.fxRateMovToBase || 1,
      fxRateCCYToBase: line.fxRateCCYToBase || 1,
      taxCodeId: line.taxCodeId,
      taxRate,
      taxAmountDoc: roundMoney(line.taxAmountDoc ?? (lineTotalDoc * taxRate)),
      taxAmountBase: roundMoney(line.taxAmountBase ?? (lineTotalBase * taxRate)),
      revenueAccountId: line.revenueAccountId,
      cogsAccountId: line.cogsAccountId,
      inventoryAccountId: line.inventoryAccountId,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
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
      reason: this.reason,
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
      reason: data.reason,
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
