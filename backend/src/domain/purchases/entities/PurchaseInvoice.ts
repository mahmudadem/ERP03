import { roundMoney } from '../../../application/system-core/money/roundMoney';
import { calculateCommercialLineAmounts } from '../../../application/system-core/commercial/CommercialCore';
import { PurchaseTaxTreatment } from '../../shared/entities/TaxCode';
export type PIStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type DocumentSource = 'native' | 'default_form' | 'custom_form';
export type PurchaseDiscountType = 'PERCENT' | 'AMOUNT';
/**
 * Whole-invoice adjustment kind (purchases side). A CHARGE adds to the bill total and
 * debits its account (e.g. freight/landed cost we owe the vendor); a DISCOUNT subtracts
 * from the total and credits its account (e.g. an invoice-wide purchase discount received).
 * Both are flat, tax-free adjustments entered from the allocation grid — they never
 * re-prorate line tax. Mirrors the Sales side (SalesChargeKind) with the GL sides flipped.
 */
export type PurchaseChargeKind = 'CHARGE' | 'DISCOUNT';

export interface PurchaseInvoiceCharge {
  chargeId: string;
  /** CHARGE (adds, debits its account) or DISCOUNT (subtracts, credits its account). Defaults to CHARGE. */
  kind?: PurchaseChargeKind;
  code?: string;
  name: string;
  amountDoc: number;
  amountBase?: number;
  /** The GL account this adjustment posts to (charge → expense/landed; discount → discount-received). */
  accountId?: string;
  description?: string;
}

/**
 * Settlement the user entered at post time, preserved on the invoice when posting
 * is parked for accounting approval. Replayed when the invoice is approved so the
 * cash payment is not lost across the approval boundary. Structurally compatible
 * with the application-layer `SettlementInput` (kept domain-local to avoid an
 * application→domain import). See docs/architecture/purchases.md (approval + settlement).
 */
export interface PendingSettlementRow {
  settlementAccountId?: string;
  amountBase: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface PendingSettlement {
  settlementMode: 'DEFERRED' | 'CASH_FULL' | 'MULTI';
  receivablePayableAccountId?: string;
  settlements: PendingSettlementRow[];
}

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
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  /** Pre-discount line extension (qty × unitPriceDoc), in document currency. */
  grossLineTotalDoc?: number;
  /** Optional line-level discount. Mirrors sales: PERCENT or AMOUNT. */
  discountType?: PurchaseDiscountType;
  discountValue?: number;
  /** Resolved discount amount in document currency. */
  discountAmountDoc?: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  /** Pre-discount line extension in base currency. */
  grossLineTotalBase?: number;
  /** Resolved discount amount in base currency. */
  discountAmountBase?: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  purchaseTaxTreatment?: PurchaseTaxTreatment;
  // When true, `unitPriceDoc` already includes tax. The entity derives net
  // (lineTotalDoc) and tax (taxAmountDoc) by splitting the gross — same
  // shape as the SI fix (Task 168) and the SO fix (Task 170B).
  priceIsInclusive?: boolean;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  accountId: string;
  stockMovementId?: string | null;
  /**
   * Outcome of inventory/expense posting decision for this line. Set at PI posting.
   * For purchases: POSTED on both stock and service lines; SKIPPED variants for
   * deferred / unsettled cases mirroring sales. See PostingLog.
   */
  cogsPostingStatus?:
    | 'POSTED'
    | 'SKIPPED_POSTED_AT_GRN'
    | 'SKIPPED_SERVICE_ITEM'
    | 'SKIPPED_DEFERRED_POLICY'
    | 'SKIPPED_UNSETTLED_COST'
    | null;
  description?: string;
}

export interface PurchaseInvoiceAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PurchaseInvoiceProps {
  id: string;
  companyId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  formType: string;
  voucherType: string;
  persona: string;
  source?: DocumentSource | string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseInvoiceLine[];
  charges?: PurchaseInvoiceCharge[];
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
  attachments?: PurchaseInvoiceAttachment[];
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
  /** Settlement preserved while parked for approval; replayed on approve, cleared on post. */
  pendingSettlement?: PendingSettlement | null;
}

const PI_STATUSES: PIStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
const DOCUMENT_SOURCES: DocumentSource[] = ['native', 'default_form', 'custom_form'];
const PURCHASE_DISCOUNT_TYPES: PurchaseDiscountType[] = ['PERCENT', 'AMOUNT'];


const normalizePurchaseDiscountType = (value: any): PurchaseDiscountType | undefined => {
  if (value === null || value === undefined) return undefined;
  const token = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return PURCHASE_DISCOUNT_TYPES.includes(token as PurchaseDiscountType)
    ? (token as PurchaseDiscountType)
    : undefined;
};

const normalizePurchaseChargeKind = (value: any): PurchaseChargeKind =>
  (typeof value === 'string' ? value.trim().toUpperCase() : '') === 'DISCOUNT' ? 'DISCOUNT' : 'CHARGE';

const normalizeDocumentSource = (value: any): DocumentSource => {
  const source = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return DOCUMENT_SOURCES.includes(source as DocumentSource) ? source as DocumentSource : 'default_form';
};

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
  readonly formType: string;
  readonly voucherType: string;
  readonly persona: string;
  readonly source: DocumentSource;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseInvoiceLine[];
  charges: PurchaseInvoiceCharge[];
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
  attachments: PurchaseInvoiceAttachment[];
  notes?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
  pendingSettlement?: PendingSettlement | null;

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
    this.formType = props.formType?.trim() || 'purchase_invoice_direct';
    this.voucherType = props.voucherType?.trim() || 'purchase_invoice';
    this.persona = props.persona?.trim() || 'direct';
    this.source = normalizeDocumentSource(props.source);
    this.purchaseOrderId = props.purchaseOrderId;
    this.goodsReceiptId = props.goodsReceiptId;
    this.vendorId = props.vendorId.trim();
    this.vendorName = props.vendorName || '';
    this.invoiceDate = props.invoiceDate;
    this.dueDate = props.dueDate;
    this.currency = props.currency.toUpperCase().trim();
    this.exchangeRate = props.exchangeRate;
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));
    this.charges = (props.charges || []).map((charge, index) => this.normalizeCharge(charge, index));

    // A DISCOUNT-kind adjustment subtracts from the subtotal; a CHARGE adds. Both are
    // tax-free, so they only move the subtotal/grand total, never the tax total.
    const chargeSubtotalDoc = this.charges.reduce(
      (sum, charge) => sum + (charge.kind === 'DISCOUNT' ? -charge.amountDoc : charge.amountDoc), 0);
    const chargeSubtotalBase = this.charges.reduce(
      (sum, charge) => sum + (charge.kind === 'DISCOUNT' ? -(charge.amountBase || 0) : (charge.amountBase || 0)), 0);

    this.subtotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0) + chargeSubtotalDoc);
    this.taxTotalDoc = roundMoney(this.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    this.grandTotalDoc = roundMoney(this.subtotalDoc + this.taxTotalDoc);
    this.subtotalBase = roundMoney(this.lines.reduce((sum, line) => sum + line.lineTotalBase, 0) + chargeSubtotalBase);
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
    this.attachments = Array.isArray(props.attachments)
      ? props.attachments.map((attachment) => ({ ...attachment }))
      : [];
    this.notes = props.notes;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
    this.pendingSettlement = props.pendingSettlement ?? null;
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
    const priceIsInclusive = line.priceIsInclusive === true;
    const discountType = normalizePurchaseDiscountType(line.discountType);
    const discountValueRaw = Number(line.discountValue);
    const discountValue = Number.isNaN(discountValueRaw) ? 0 : discountValueRaw;
    const explicitDiscountDoc =
      line.discountAmountDoc !== undefined ? Number(line.discountAmountDoc) : undefined;

    const amounts = calculateCommercialLineAmounts({
      quantity: line.invoicedQty,
      unitPriceDoc: line.unitPriceDoc,
      exchangeRate: this.exchangeRate,
      taxRate,
      priceIsInclusive,
      discountType,
      discountValue,
      discountAmountDoc: explicitDiscountDoc,
      currency: this.currency,
    });
    const purchaseTaxTreatment = line.purchaseTaxTreatment || 'RECOVERABLE';
    const capitalizePurchaseTax = purchaseTaxTreatment === 'NON_RECOVERABLE';
    const lineTotalDoc = capitalizePurchaseTax
      ? roundMoney(amounts.lineTotalDoc + amounts.taxAmountDoc)
      : amounts.lineTotalDoc;
    const lineTotalBase = capitalizePurchaseTax
      ? roundMoney(amounts.lineTotalBase + amounts.taxAmountBase)
      : amounts.lineTotalBase;
    const taxAmountDoc = capitalizePurchaseTax ? 0 : amounts.taxAmountDoc;
    const taxAmountBase = capitalizePurchaseTax ? 0 : amounts.taxAmountBase;

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
      uomId: line.uomId,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      grossLineTotalDoc: amounts.grossLineTotalDoc,
      discountType,
      discountValue: discountType ? discountValue : undefined,
      discountAmountDoc: amounts.discountAmountDoc,
      lineTotalDoc,
      unitPriceBase: amounts.unitPriceBase,
      grossLineTotalBase: amounts.grossLineTotalBase,
      discountAmountBase: amounts.discountAmountBase,
      lineTotalBase,
      taxCodeId: line.taxCodeId,
      taxCode: line.taxCode,
      taxRate,
      purchaseTaxTreatment,
      priceIsInclusive,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: line.warehouseId,
      accountId: line.accountId || '',
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  private normalizeCharge(charge: PurchaseInvoiceCharge, index: number): PurchaseInvoiceCharge {
    const chargeId = (charge.chargeId || '').trim();
    const name = (charge.name || '').trim();
    const amountDocRaw = Number(charge.amountDoc);
    const kind = normalizePurchaseChargeKind(charge.kind);

    if (!chargeId) throw new Error(`PurchaseInvoice charge ${index + 1}: chargeId is required`);
    if (!name) throw new Error(`PurchaseInvoice charge ${index + 1}: name is required`);
    if (amountDocRaw < 0 || Number.isNaN(amountDocRaw)) {
      throw new Error(`PurchaseInvoice charge ${index + 1}: amountDoc must be greater than or equal to 0`);
    }

    const amountDoc = roundMoney(amountDocRaw);
    const amountBase = roundMoney(charge.amountBase !== undefined ? Number(charge.amountBase) : amountDoc * this.exchangeRate);

    return {
      chargeId,
      kind,
      code: charge.code,
      name,
      amountDoc,
      amountBase,
      accountId: charge.accountId,
      description: charge.description,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      invoiceNumber: this.invoiceNumber,
      vendorInvoiceNumber: this.vendorInvoiceNumber,
      formType: this.formType,
      voucherType: this.voucherType,
      persona: this.persona,
      source: this.source,
      purchaseOrderId: this.purchaseOrderId,
      goodsReceiptId: this.goodsReceiptId,
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      invoiceDate: this.invoiceDate,
      dueDate: this.dueDate,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((line) => ({ ...line })),
      charges: this.charges.map((charge) => ({ ...charge })),
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
      attachments: this.attachments.map((attachment) => ({ ...attachment })),
      notes: this.notes,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
      pendingSettlement: this.pendingSettlement ?? null,
    };
  }

  static fromJSON(data: any): PurchaseInvoice {
    return new PurchaseInvoice({
      id: data.id,
      companyId: data.companyId,
      invoiceNumber: data.invoiceNumber,
      vendorInvoiceNumber: data.vendorInvoiceNumber,
      formType: data.formType || data.baseType || 'purchase_invoice_direct',
      voucherType: data.voucherType || 'purchase_invoice',
      persona: data.persona || 'direct',
      source: data.source || data.documentSource || 'default_form',
      purchaseOrderId: data.purchaseOrderId,
      goodsReceiptId: data.goodsReceiptId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      charges: data.charges || [],
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
      attachments: data.attachments || [],
      notes: data.notes,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
      pendingSettlement: data.pendingSettlement ?? null,
    });
  }
}
