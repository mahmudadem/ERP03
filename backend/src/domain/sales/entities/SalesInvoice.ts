import { AppliedPromotionInfo } from './AppliedPromotion';

export type SIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type DocumentSource = 'native' | 'default_form' | 'custom_form';
export type SalesDiscountType = 'PERCENT' | 'AMOUNT';

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
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  grossLineTotalDoc?: number;
  discountType?: SalesDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  grossLineTotalBase?: number;
  discountAmountBase?: number;
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
  /**
   * Outcome of the COGS recognition decision for this line. Set during posting.
   * null/undefined means "not yet posted" or "N/A" (e.g. line was rejected before posting).
   * See PostingLog and docs/architecture/posting-log.md for the taxonomy.
   */
  cogsPostingStatus?:
    | 'POSTED'
    | 'SKIPPED_POSTED_AT_DN'
    | 'SKIPPED_SERVICE_ITEM'
    | 'SKIPPED_DEFERRED_POLICY'
    | 'SKIPPED_UNSETTLED_COST'
    | null;
  description?: string;
  appliedPromotionId?: string;
  appliedPromotionName?: string;
  appliedDiscountPct?: number;
}

export interface SalesInvoiceCharge {
  chargeId: string;
  code?: string;
  name: string;
  amountDoc: number;
  amountBase?: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate?: number;
  taxAmountDoc?: number;
  taxAmountBase?: number;
  revenueAccountId?: string;
  description?: string;
}

export interface SalesInvoiceAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface SalesInvoiceProps {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerInvoiceNumber?: string;
  voucherFormId?: string;
  formType: string;
  voucherType: string;
  persona: string;
  source?: DocumentSource | string;
  salesOrderId?: string;
  salespersonId?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLine[];
  charges?: SalesInvoiceCharge[];
  attachments?: SalesInvoiceAttachment[];
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
  appliedPromotions?: AppliedPromotionInfo[];
}

const SI_STATUSES: SIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
const DOCUMENT_SOURCES: DocumentSource[] = ['native', 'default_form', 'custom_form'];
const DISCOUNT_TYPES: SalesDiscountType[] = ['PERCENT', 'AMOUNT'];
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const REF_KEYS = [
  'id',
  'value',
  'code',
  'key',
  'uid',
  'uuid',
  'customerId',
  'itemId',
  'warehouseId',
  'accountId',
  'lineId',
  'uomId',
  'formType',
  'baseType',
  'voucherType',
  'name',
  'label',
];

const TEXT_KEYS = [
  'label',
  'name',
  'displayName',
  'text',
  'code',
  'value',
  'id',
  'key',
];

const toStringRef = (value: any): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    for (const key of REF_KEYS) {
      const candidate = value[key];
      if (candidate === undefined || candidate === null || candidate === '') continue;
      return String(candidate).trim();
    }
    return '';
  }
  return String(value).trim();
};

const toOptionalStringRef = (value: any): string | undefined => {
  const text = toStringRef(value);
  return text || undefined;
};

const normalizeDocumentSource = (value: any): DocumentSource => {
  const source = toStringRef(value).toLowerCase();
  return DOCUMENT_SOURCES.includes(source as DocumentSource) ? source as DocumentSource : 'default_form';
};

const toDisplayText = (value: any): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    for (const key of TEXT_KEYS) {
      const candidate = value[key];
      if (candidate === undefined || candidate === null || candidate === '') continue;
      return String(candidate).trim();
    }
    return '';
  }
  return String(value).trim();
};

const toOptionalDisplayText = (value: any): string | undefined => {
  const text = toDisplayText(value);
  return text || undefined;
};

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

const normalizeDiscountType = (value: any): SalesDiscountType | undefined => {
  const token = toOptionalStringRef(value)?.toUpperCase();
  return token && DISCOUNT_TYPES.includes(token as SalesDiscountType) ? (token as SalesDiscountType) : undefined;
};

const calculateDiscountAmountDoc = (
  grossLineTotalDoc: number,
  discountType: SalesDiscountType | undefined,
  discountValue: number,
  explicitDiscountAmountDoc: number | undefined
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

export class SalesInvoice {
  readonly id: string;
  readonly companyId: string;
  invoiceNumber: string;
  customerInvoiceNumber?: string;
  readonly voucherFormId?: string;
  readonly formType: string;
  readonly voucherType: string;
  readonly persona: string;
  readonly source: DocumentSource;
  salesOrderId?: string;
  salespersonId?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLine[];
  charges: SalesInvoiceCharge[];
  attachments: SalesInvoiceAttachment[];
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
  appliedPromotions?: AppliedPromotionInfo[];

  constructor(props: SalesInvoiceProps) {
    const id = toStringRef(props.id);
    const companyId = toStringRef(props.companyId);
    const invoiceNumber = toStringRef(props.invoiceNumber);
    const formType = toStringRef(props.formType);
    const voucherType = toStringRef(props.voucherType);
    const persona = toStringRef(props.persona);
    const customerId = toStringRef(props.customerId);
    const invoiceDate = toStringRef(props.invoiceDate);
    const currency = toStringRef(props.currency);
    const createdBy = toStringRef(props.createdBy);
    const exchangeRate = Number(props.exchangeRate);

    if (!id) throw new Error('SalesInvoice id is required');
    if (!companyId) throw new Error('SalesInvoice companyId is required');
    if (!invoiceNumber) throw new Error('SalesInvoice invoiceNumber is required');
    if (!voucherType) throw new Error('SalesInvoice voucherType is required');
    if (!persona) throw new Error('SalesInvoice persona is required');
    if (!customerId) throw new Error('SalesInvoice customerId is required');
    if (!invoiceDate) throw new Error('SalesInvoice invoiceDate is required');
    if (!currency) throw new Error('SalesInvoice currency is required');
    if (!createdBy) throw new Error('SalesInvoice createdBy is required');
    if (exchangeRate <= 0 || Number.isNaN(exchangeRate)) {
      throw new Error('SalesInvoice exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('SalesInvoice must contain at least one line');
    }

    this.id = id;
    this.companyId = companyId;
    this.invoiceNumber = invoiceNumber;
    this.customerInvoiceNumber = toOptionalStringRef(props.customerInvoiceNumber);
    this.voucherFormId = toOptionalStringRef(props.voucherFormId);
    this.formType = formType;
    this.voucherType = voucherType;
    this.persona = persona;
    this.source = normalizeDocumentSource(props.source);
    this.salesOrderId = toOptionalStringRef(props.salesOrderId);
    this.salespersonId = toOptionalStringRef(props.salespersonId);
    this.customerId = customerId;
    this.customerName = toDisplayText(props.customerName);
    this.invoiceDate = invoiceDate;
    this.dueDate = toOptionalStringRef(props.dueDate);
    this.currency = currency.toUpperCase();
    this.exchangeRate = exchangeRate;
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
    this.charges = (props.charges || []).map((charge, index) => this.normalizeCharge(charge, index));
    this.attachments = Array.isArray(props.attachments)
      ? props.attachments.map((attachment) => ({
          id: toStringRef(attachment.id),
          name: toDisplayText(attachment.name),
          size: Number(attachment.size || 0),
          type: toDisplayText(attachment.type),
          path: toStringRef(attachment.path),
          uploadedAt: toStringRef(attachment.uploadedAt),
          uploadedBy: toStringRef(attachment.uploadedBy),
        }))
      : [];

    this.subtotalDoc = roundMoney(
      this.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0)
      + this.charges.reduce((sum, charge) => sum + charge.amountDoc, 0)
    );
    this.taxTotalDoc = roundMoney(
      this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0)
      + this.charges.reduce((sum, charge) => sum + (charge.taxAmountDoc || 0), 0)
    );
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.subtotalBase = roundMoney(
      this.lines.reduce((sum, line) => sum + line.lineTotalBase, 0)
      + this.charges.reduce((sum, charge) => sum + (charge.amountBase || 0), 0)
    );
    this.taxTotalBase = roundMoney(
      this.lines.reduce((sum, line) => sum + line.taxAmountBase, 0)
      + this.charges.reduce((sum, charge) => sum + (charge.taxAmountBase || 0), 0)
    );
    this.grandTotalBase = roundMoney(this.subtotalBase + this.taxTotalBase);

    this.paymentTermsDays = props.paymentTermsDays ?? 0;
    this.paidAmountBase = props.paidAmountBase ?? 0;

    const status = (toStringRef(props.status) || 'DRAFT') as SIStatus;
    if (!SI_STATUSES.includes(status)) {
      throw new Error(`Invalid sales invoice status: ${status}`);
    }
    this.status = status;

    const paymentStatus = (toStringRef(props.paymentStatus) || 'UNPAID') as PaymentStatus;
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
    this.notes = toOptionalDisplayText(props.notes);
    this.createdBy = createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
    this.appliedPromotions = props.appliedPromotions;
  }

  private normalizeLine(line: SalesInvoiceLine, index: number): SalesInvoiceLine {
    const lineId = toStringRef(line.lineId);
    const itemId = toStringRef(line.itemId);
    const uom = toDisplayText(line.uom);
    const invoicedQty = Number(line.invoicedQty);
    const unitPriceDoc = Number(line.unitPriceDoc);

    if (!lineId) throw new Error(`SalesInvoice line ${index + 1}: lineId is required`);
    if (!itemId) throw new Error(`SalesInvoice line ${index + 1}: itemId is required`);
    if (invoicedQty <= 0 || Number.isNaN(invoicedQty)) {
      throw new Error(`SalesInvoice line ${index + 1}: invoicedQty must be greater than 0`);
    }
    if (!uom) throw new Error(`SalesInvoice line ${index + 1}: uom is required`);
    if (unitPriceDoc < 0 || Number.isNaN(unitPriceDoc)) {
      throw new Error(`SalesInvoice line ${index + 1}: unitPriceDoc must be greater than or equal to 0`);
    }

    const taxRateValue = Number(line.taxRate);
    const taxRate = Number.isNaN(taxRateValue) ? 0 : taxRateValue;
    const grossLineTotalDoc = roundMoney(invoicedQty * unitPriceDoc);
    const discountType = normalizeDiscountType(line.discountType);
    const discountValueRaw = Number(line.discountValue);
    const discountValue = Number.isNaN(discountValueRaw) ? 0 : discountValueRaw;
    const explicitDiscountDoc = line.discountAmountDoc !== undefined ? Number(line.discountAmountDoc) : undefined;
    const discountAmountDoc = calculateDiscountAmountDoc(grossLineTotalDoc, discountType, discountValue, explicitDiscountDoc);
    const lineTotalDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
    const unitPriceBase = roundMoney(unitPriceDoc * this.exchangeRate);
    const grossLineTotalBase = roundMoney(grossLineTotalDoc * this.exchangeRate);
    const discountAmountBase = roundMoney(discountAmountDoc * this.exchangeRate);
    const lineTotalBase = roundMoney(lineTotalDoc * this.exchangeRate);
    const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
    const taxAmountBase = roundMoney(lineTotalBase * taxRate);

    return {
      lineId,
      lineNo: line.lineNo || index + 1,
      soLineId: toOptionalStringRef(line.soLineId),
      dnLineId: toOptionalStringRef(line.dnLineId),
      itemId,
      itemCode: toDisplayText(line.itemCode),
      itemName: toDisplayText(line.itemName),
      trackInventory: !!line.trackInventory,
      invoicedQty,
      uomId: toOptionalStringRef(line.uomId),
      uom,
      unitPriceDoc,
      grossLineTotalDoc,
      discountType,
      discountValue: discountType ? discountValue : undefined,
      discountAmountDoc,
      lineTotalDoc,
      unitPriceBase,
      grossLineTotalBase,
      discountAmountBase,
      lineTotalBase,
      taxCodeId: toOptionalStringRef(line.taxCodeId),
      taxCode: toOptionalDisplayText(line.taxCode),
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: toOptionalStringRef(line.warehouseId),
      revenueAccountId: toStringRef(line.revenueAccountId),
      cogsAccountId: toOptionalStringRef(line.cogsAccountId),
      inventoryAccountId: toOptionalStringRef(line.inventoryAccountId),
      unitCostBase: line.unitCostBase,
      lineCostBase: line.lineCostBase,
      stockMovementId: toOptionalStringRef(line.stockMovementId) ?? null,
      description: toOptionalDisplayText(line.description),
      appliedPromotionId: line.appliedPromotionId,
      appliedPromotionName: line.appliedPromotionName,
      appliedDiscountPct: line.appliedDiscountPct,
    };
  }

  private normalizeCharge(charge: SalesInvoiceCharge, index: number): SalesInvoiceCharge {
    const chargeId = toStringRef(charge.chargeId);
    const name = toDisplayText(charge.name);
    const amountDocRaw = Number(charge.amountDoc);
    const taxRateRaw = Number(charge.taxRate);
    const taxRate = Number.isNaN(taxRateRaw) ? 0 : taxRateRaw;

    if (!chargeId) throw new Error(`SalesInvoice charge ${index + 1}: chargeId is required`);
    if (!name) throw new Error(`SalesInvoice charge ${index + 1}: name is required`);
    if (amountDocRaw < 0 || Number.isNaN(amountDocRaw)) {
      throw new Error(`SalesInvoice charge ${index + 1}: amountDoc must be greater than or equal to 0`);
    }

    const amountDoc = roundMoney(amountDocRaw);
    const amountBase = roundMoney(charge.amountBase !== undefined ? Number(charge.amountBase) : amountDoc * this.exchangeRate);
    const taxAmountDoc = roundMoney(charge.taxAmountDoc !== undefined ? Number(charge.taxAmountDoc) : amountDoc * taxRate);
    const taxAmountBase = roundMoney(charge.taxAmountBase !== undefined ? Number(charge.taxAmountBase) : amountBase * taxRate);

    return {
      chargeId,
      code: toOptionalStringRef(charge.code),
      name,
      amountDoc,
      amountBase,
      taxCodeId: toOptionalStringRef(charge.taxCodeId),
      taxCode: toOptionalDisplayText(charge.taxCode),
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      revenueAccountId: toOptionalStringRef(charge.revenueAccountId),
      description: toOptionalDisplayText(charge.description),
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      invoiceNumber: this.invoiceNumber,
      customerInvoiceNumber: this.customerInvoiceNumber,
      voucherFormId: this.voucherFormId,
      voucherTypeId: this.formType,
      formType: this.formType,
      voucherType: this.voucherType,
      persona: this.persona,
      source: this.source,
      salesOrderId: this.salesOrderId,
      salespersonId: this.salespersonId,
      customerId: this.customerId,
      customerName: this.customerName,
      invoiceDate: this.invoiceDate,
      dueDate: this.dueDate,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((line) => ({ ...line })),
      charges: this.charges.map((charge) => ({ ...charge })),
      attachments: this.attachments.map((attachment) => ({ ...attachment })),
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
      appliedPromotions: this.appliedPromotions,
    };
  }

  static fromJSON(data: any): SalesInvoice {
    const formType = toStringRef(data.formType || data.voucherTypeId);
    const formToken = formType.toLowerCase();
    const inferredPersona = formToken.includes('linked')
      ? 'linked'
      : formToken.includes('service')
        ? 'service'
        : 'direct';
    const rawVoucherType = toStringRef(data.voucherType);
    const voucherTypeToken = rawVoucherType.toLowerCase();
    const voucherType = voucherTypeToken.startsWith('sales_invoice')
      ? 'sales_invoice'
      : rawVoucherType || (formToken.startsWith('sales_invoice') ? 'sales_invoice' : formType);

    return new SalesInvoice({
      id: data.id,
      companyId: data.companyId,
      invoiceNumber: data.invoiceNumber,
      customerInvoiceNumber: data.customerInvoiceNumber,
      voucherFormId: data.voucherFormId,
      formType,
      voucherType,
      persona: data.persona || inferredPersona,
      source: data.source || data.documentSource || 'default_form',
      salesOrderId: data.salesOrderId,
      salespersonId: data.salespersonId,
      customerId: data.customerId,
      customerName: data.customerName,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      charges: data.charges || [],
      attachments: data.attachments || [],
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
      appliedPromotions: data.appliedPromotions,
    });
  }
}
