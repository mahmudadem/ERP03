export type PRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT';

export interface PurchaseReturnLine {
  lineId: string;
  lineNo: number;
  piLineId?: string;
  grnLineId?: string;
  poLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  returnQty: number;
  uomId?: string;
  uom: string;
  unitCostDoc: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  accountId?: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface PurchaseReturnProps {
  id: string;
  companyId: string;
  returnNumber: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  returnContext: ReturnContext;
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseReturnLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  reason: string;
  notes?: string;
  status?: PRStatus;
  voucherId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
}

const PR_STATUSES: PRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const RETURN_CONTEXTS: ReturnContext[] = ['AFTER_INVOICE', 'BEFORE_INVOICE', 'DIRECT'];
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class PurchaseReturn {
  readonly id: string;
  readonly companyId: string;
  returnNumber: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  returnContext: ReturnContext;
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseReturnLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  reason: string;
  notes?: string;
  status: PRStatus;
  voucherId?: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;

  constructor(props: PurchaseReturnProps) {
    if (!props.id?.trim()) throw new Error('PurchaseReturn id is required');
    if (!props.companyId?.trim()) throw new Error('PurchaseReturn companyId is required');
    if (!props.returnNumber?.trim()) throw new Error('PurchaseReturn returnNumber is required');
    if (!props.vendorId?.trim()) throw new Error('PurchaseReturn vendorId is required');
    if (!props.returnDate?.trim()) throw new Error('PurchaseReturn returnDate is required');
    if (!props.warehouseId?.trim()) throw new Error('PurchaseReturn warehouseId is required');
    if (!props.currency?.trim()) throw new Error('PurchaseReturn currency is required');
    if (!props.reason?.trim()) throw new Error('PurchaseReturn reason is required');
    if (!props.createdBy?.trim()) throw new Error('PurchaseReturn createdBy is required');
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('PurchaseReturn exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('PurchaseReturn must contain at least one line');
    }
    if (!RETURN_CONTEXTS.includes(props.returnContext)) {
      throw new Error(`Invalid returnContext: ${props.returnContext}`);
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.returnNumber = props.returnNumber.trim();
    this.purchaseInvoiceId = props.purchaseInvoiceId;
    this.goodsReceiptId = props.goodsReceiptId;
    this.purchaseOrderId = props.purchaseOrderId;
    this.vendorId = props.vendorId.trim();
    this.vendorName = props.vendorName || '';
    this.returnContext = props.returnContext;
    this.returnDate = props.returnDate;
    this.warehouseId = props.warehouseId.trim();
    this.currency = props.currency.toUpperCase().trim();
    this.exchangeRate = props.exchangeRate;
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));

    this.subtotalDoc = roundMoney(
      this.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * line.unitCostDoc), 0)
    );
    this.subtotalBase = roundMoney(
      this.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * line.unitCostBase), 0)
    );
    this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);

    const status = props.status || 'DRAFT';
    if (!PR_STATUSES.includes(status)) {
      throw new Error(`Invalid purchase return status: ${status}`);
    }
    this.status = status;

    this.reason = props.reason.trim();
    this.notes = props.notes;
    this.voucherId = props.voucherId ?? null;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
  }

  private normalizeLine(line: PurchaseReturnLine, index: number): PurchaseReturnLine {
    if (!line.lineId?.trim()) throw new Error(`PurchaseReturn line ${index + 1}: lineId is required`);
    if (!line.itemId?.trim()) throw new Error(`PurchaseReturn line ${index + 1}: itemId is required`);
    if (line.returnQty <= 0 || Number.isNaN(line.returnQty)) {
      throw new Error(`PurchaseReturn line ${index + 1}: returnQty must be greater than 0`);
    }
    if (!line.uom?.trim()) throw new Error(`PurchaseReturn line ${index + 1}: uom is required`);
    if (line.unitCostDoc < 0 || Number.isNaN(line.unitCostDoc)) {
      throw new Error(`PurchaseReturn line ${index + 1}: unitCostDoc must be greater than or equal to 0`);
    }

    const unitCostBase = Number.isNaN(line.unitCostBase)
      ? roundMoney(line.unitCostDoc * this.exchangeRate)
      : roundMoney(line.unitCostBase);
    const taxRate = Number.isNaN(line.taxRate) ? 0 : line.taxRate;
    const lineTotalDoc = roundMoney(line.returnQty * line.unitCostDoc);
    const lineTotalBase = roundMoney(line.returnQty * unitCostBase);
    const taxAmountDoc = roundMoney(
      line.taxAmountDoc !== undefined ? line.taxAmountDoc : lineTotalDoc * taxRate
    );
    const taxAmountBase = roundMoney(
      line.taxAmountBase !== undefined ? line.taxAmountBase : lineTotalBase * taxRate
    );

    return {
      lineId: line.lineId,
      lineNo: line.lineNo || index + 1,
      piLineId: line.piLineId,
      grnLineId: line.grnLineId,
      poLineId: line.poLineId,
      itemId: line.itemId,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      returnQty: line.returnQty,
      uomId: line.uomId,
      uom: line.uom,
      unitCostDoc: line.unitCostDoc,
      unitCostBase,
      fxRateMovToBase: line.fxRateMovToBase || this.exchangeRate,
      fxRateCCYToBase: line.fxRateCCYToBase || this.exchangeRate,
      taxCodeId: line.taxCodeId,
      taxCode: line.taxCode,
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      accountId: line.accountId,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      returnNumber: this.returnNumber,
      purchaseInvoiceId: this.purchaseInvoiceId,
      goodsReceiptId: this.goodsReceiptId,
      purchaseOrderId: this.purchaseOrderId,
      vendorId: this.vendorId,
      vendorName: this.vendorName,
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
      voucherId: this.voucherId ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): PurchaseReturn {
    return new PurchaseReturn({
      id: data.id,
      companyId: data.companyId,
      returnNumber: data.returnNumber,
      purchaseInvoiceId: data.purchaseInvoiceId,
      goodsReceiptId: data.goodsReceiptId,
      purchaseOrderId: data.purchaseOrderId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
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
      voucherId: data.voucherId ?? null,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
    });
  }
}
