export type SIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface SalesInvoiceLine {
  lineId: string;
  lineNo: number;
  soLineId?: string;
  dnLineId?: string;
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
  revenueAccountId: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  unitCostBase?: number;
  lineCostBase?: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface SalesInvoiceProps {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerInvoiceNumber?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLine[];
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
  status?: SIStatus;
  voucherId?: string | null;
  cogsVoucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
}

const SI_STATUSES: SIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class SalesInvoice {
  readonly id: string;
  readonly companyId: string;
  invoiceNumber: string;
  customerInvoiceNumber?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLine[];
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
  status: SIStatus;
  voucherId?: string | null;
  cogsVoucherId?: string | null;
  notes?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;

  constructor(props: SalesInvoiceProps) {
    if (!props.id?.trim()) throw new Error('SalesInvoice id is required');
    if (!props.companyId?.trim()) throw new Error('SalesInvoice companyId is required');
    if (!props.invoiceNumber?.trim()) throw new Error('SalesInvoice invoiceNumber is required');
    if (!props.customerId?.trim()) throw new Error('SalesInvoice customerId is required');
    if (!props.invoiceDate?.trim()) throw new Error('SalesInvoice invoiceDate is required');
    if (!props.currency?.trim()) throw new Error('SalesInvoice currency is required');
    if (!props.createdBy?.trim()) throw new Error('SalesInvoice createdBy is required');
    if (props.exchangeRate <= 0 || Number.isNaN(props.exchangeRate)) {
      throw new Error('SalesInvoice exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('SalesInvoice must contain at least one line');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.invoiceNumber = props.invoiceNumber.trim();
    this.customerInvoiceNumber = props.customerInvoiceNumber;
    this.salesOrderId = props.salesOrderId;
    this.customerId = props.customerId.trim();
    this.customerName = props.customerName || '';
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
    if (!SI_STATUSES.includes(status)) {
      throw new Error(`Invalid sales invoice status: ${status}`);
    }
    this.status = status;

    const paymentStatus = props.paymentStatus || 'UNPAID';
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new Error(`Invalid sales invoice paymentStatus: ${paymentStatus}`);
    }
    this.paymentStatus = paymentStatus;

    this.outstandingAmountBase = roundMoney(
      props.outstandingAmountBase !== undefined
        ? props.outstandingAmountBase
        : this.grandTotalBase - this.paidAmountBase
    );

    this.voucherId = props.voucherId ?? null;
    this.cogsVoucherId = props.cogsVoucherId ?? null;
    this.notes = props.notes;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
  }

  private normalizeLine(line: SalesInvoiceLine, index: number): SalesInvoiceLine {
    if (!line.lineId?.trim()) throw new Error(`SalesInvoice line ${index + 1}: lineId is required`);
    if (!line.itemId?.trim()) throw new Error(`SalesInvoice line ${index + 1}: itemId is required`);
    if (line.invoicedQty <= 0 || Number.isNaN(line.invoicedQty)) {
      throw new Error(`SalesInvoice line ${index + 1}: invoicedQty must be greater than 0`);
    }
    if (!line.uom?.trim()) throw new Error(`SalesInvoice line ${index + 1}: uom is required`);
    if (line.unitPriceDoc < 0 || Number.isNaN(line.unitPriceDoc)) {
      throw new Error(`SalesInvoice line ${index + 1}: unitPriceDoc must be greater than or equal to 0`);
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
      soLineId: line.soLineId,
      dnLineId: line.dnLineId,
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
      revenueAccountId: line.revenueAccountId || '',
      cogsAccountId: line.cogsAccountId,
      inventoryAccountId: line.inventoryAccountId,
      unitCostBase: line.unitCostBase,
      lineCostBase: line.lineCostBase,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      invoiceNumber: this.invoiceNumber,
      customerInvoiceNumber: this.customerInvoiceNumber,
      salesOrderId: this.salesOrderId,
      customerId: this.customerId,
      customerName: this.customerName,
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
      cogsVoucherId: this.cogsVoucherId ?? null,
      notes: this.notes,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): SalesInvoice {
    return new SalesInvoice({
      id: data.id,
      companyId: data.companyId,
      invoiceNumber: data.invoiceNumber,
      customerInvoiceNumber: data.customerInvoiceNumber,
      salesOrderId: data.salesOrderId,
      customerId: data.customerId,
      customerName: data.customerName,
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
      cogsVoucherId: data.cogsVoucherId ?? null,
      notes: data.notes,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
    });
  }
}
