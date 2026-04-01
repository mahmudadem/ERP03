export type PIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface PurchaseInvoiceLine {
  lineId: string;
  lineNo: number;
  poLineId?: string;
  grnLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  trackInventory: boolean;
  invoicedQty: number;
  uom: string;
  unitPriceDoc: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  accountId: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface PurchaseInvoiceProps {
  id: string;
  companyId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseInvoiceLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  paymentTermsDays: number;
  paymentStatus?: PaymentStatus;
  paidAmountBase?: number;
  outstandingAmountBase: number;
  status?: PIStatus;
  voucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
}

const PI_STATUSES: PIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class PurchaseInvoice {
  readonly id: string;
  readonly companyId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseInvoiceLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  paymentTermsDays: number;
  paymentStatus: PaymentStatus;
  paidAmountBase: number;
  outstandingAmountBase: number;
  status: PIStatus;
  voucherId?: string | null;
  notes?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;

  constructor(props: PurchaseInvoiceProps) {
    if (!props.id?.trim()) throw new Error('PurchaseInvoice id is required');
    if (!props.companyId?.trim()) throw new Error('PurchaseInvoice companyId is required');
    if (!props.invoiceNumber?.trim()) throw new Error('PurchaseInvoice invoiceNumber is required');
    if (!props.vendorId?.trim()) throw new Error('PurchaseInvoice vendorId is required');
    if (!props.invoiceDate?.trim()) throw new Error('PurchaseInvoice invoiceDate is required');
    if (!props.currency?.trim()) throw new Error('PurchaseInvoice currency is required');
    if (!props.createdBy?.trim()) throw new Error('PurchaseInvoice createdBy is required');
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('PurchaseInvoice exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('PurchaseInvoice must contain at least one line');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.invoiceNumber = props.invoiceNumber.trim();
    this.vendorInvoiceNumber = props.vendorInvoiceNumber;
    this.purchaseOrderId = props.purchaseOrderId;
    this.vendorId = props.vendorId.trim();
    this.vendorName = props.vendorName || '';
    this.invoiceDate = props.invoiceDate;
    this.dueDate = props.dueDate;
    this.currency = props.currency.toUpperCase().trim();
    this.exchangeRate = props.exchangeRate;
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));

    this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    this.taxTotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);

    this.paymentTermsDays = props.paymentTermsDays ?? 0;
    this.paidAmountBase = props.paidAmountBase ?? 0;

    const status = props.status || 'DRAFT';
    if (!PI_STATUSES.includes(status)) {
      throw new Error(`Invalid purchase invoice status: ${status}`);
    }
    this.status = status;

    const paymentStatus = props.paymentStatus || 'UNPAID';
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new Error(`Invalid purchase invoice paymentStatus: ${paymentStatus}`);
    }
    this.paymentStatus = paymentStatus;

    this.outstandingAmountBase = roundMoney(
      props.outstandingAmountBase !== undefined
        ? props.outstandingAmountBase
        : this.grandTotalBase - this.paidAmountBase
    );

    this.voucherId = props.voucherId ?? null;
    this.notes = props.notes;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
  }

  private normalizeLine(line: PurchaseInvoiceLine, index: number): PurchaseInvoiceLine {
    if (!line.lineId?.trim()) throw new Error(`PurchaseInvoice line ${index + 1}: lineId is required`);
    if (!line.itemId?.trim()) throw new Error(`PurchaseInvoice line ${index + 1}: itemId is required`);
    if (line.invoicedQty <= 0 || Number.isNaN(line.invoicedQty)) {
      throw new Error(`PurchaseInvoice line ${index + 1}: invoicedQty must be greater than 0`);
    }
    if (!line.uom?.trim()) throw new Error(`PurchaseInvoice line ${index + 1}: uom is required`);
    if (line.unitPriceDoc < 0 || Number.isNaN(line.unitPriceDoc)) {
      throw new Error(`PurchaseInvoice line ${index + 1}: unitPriceDoc must be greater than or equal to 0`);
    }

    const taxRate = Number.isNaN(line.taxRate) ? 0 : line.taxRate;
    const lineTotalDoc = roundMoney(line.invoicedQty * line.unitPriceDoc);
    const unitPriceBase = roundMoney(line.unitPriceDoc * this.exchangeRate);
    const lineTotalBase = roundMoney(lineTotalDoc * this.exchangeRate);
    const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
    const taxAmountBase = roundMoney(lineTotalBase * taxRate);

    return {
      lineId: line.lineId,
      lineNo: line.lineNo || index + 1,
      poLineId: line.poLineId,
      grnLineId: line.grnLineId,
      itemId: line.itemId,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      trackInventory: !!line.trackInventory,
      invoicedQty: line.invoicedQty,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      lineTotalDoc,
      unitPriceBase,
      lineTotalBase,
      taxCodeId: line.taxCodeId,
      taxCode: line.taxCode,
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: line.warehouseId,
      accountId: line.accountId || '',
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      invoiceNumber: this.invoiceNumber,
      vendorInvoiceNumber: this.vendorInvoiceNumber,
      purchaseOrderId: this.purchaseOrderId,
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      invoiceDate: this.invoiceDate,
      dueDate: this.dueDate,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((line) => ({ ...line })),
      subtotalDoc: this.subtotalDoc,
      taxTotalDoc: this.taxTotalDoc,
      grandTotalDoc: this.grandTotalDoc,
      subtotalBase: this.subtotalBase,
      taxTotalBase: this.taxTotalBase,
      grandTotalBase: this.grandTotalBase,
      paymentTermsDays: this.paymentTermsDays,
      paymentStatus: this.paymentStatus,
      paidAmountBase: this.paidAmountBase,
      outstandingAmountBase: this.outstandingAmountBase,
      status: this.status,
      voucherId: this.voucherId ?? null,
      notes: this.notes,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): PurchaseInvoice {
    return new PurchaseInvoice({
      id: data.id,
      companyId: data.companyId,
      invoiceNumber: data.invoiceNumber,
      vendorInvoiceNumber: data.vendorInvoiceNumber,
      purchaseOrderId: data.purchaseOrderId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      subtotalDoc: data.subtotalDoc ?? 0,
      taxTotalDoc: data.taxTotalDoc ?? 0,
      grandTotalDoc: data.grandTotalDoc ?? 0,
      subtotalBase: data.subtotalBase ?? 0,
      taxTotalBase: data.taxTotalBase ?? 0,
      grandTotalBase: data.grandTotalBase ?? 0,
      paymentTermsDays: data.paymentTermsDays ?? 0,
      paymentStatus: data.paymentStatus || 'UNPAID',
      paidAmountBase: data.paidAmountBase ?? 0,
      outstandingAmountBase: data.outstandingAmountBase ?? 0,
      status: data.status || 'DRAFT',
      voucherId: data.voucherId ?? null,
      notes: data.notes,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
    });
  }
}
