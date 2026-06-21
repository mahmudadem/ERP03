import { roundMoney } from '../../../application/system-core/money/roundMoney';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export type CommissionSourceType = 'SALES_INVOICE'; // extensible — add SO/SR later

export type CommissionStatus = 'ACCRUED' | 'PAID' | 'CANCELLED';

export interface CommissionEntryProps {
  id?: string;
  companyId: string;
  salespersonId: string;
  sourceType: CommissionSourceType;
  /** The source document id (e.g. the SalesInvoice.id) */
  sourceId: string;
  /** Human-readable number for display (e.g. "SI-2026-001") */
  sourceNumber: string;
  customerId: string;
  customerName: string;
  /** YYYY-MM-DD — the invoice date of the source document */
  invoiceDate: string;
  /**
   * The base amount on which commission is computed.
   * We use grandTotalBase from the SalesInvoice (full invoice value incl. tax).
   * This is the most intuitive basis for sales commission in a B2B ERP context:
   * the salesperson is rewarded on what the customer was charged in full.
   */
  baseAmount: number;
  /** Commission percentage frozen at accrual time — snapshot from Salesperson.defaultCommissionPct */
  commissionPct: number;
  /** Computed automatically in the constructor — do not pass a pre-calculated value */
  commissionAmountBase?: number;
  /** The base currency code at the time of accrual */
  currency: string;
  status: CommissionStatus;
  accruedAt: Date;
  paidAt?: Date;
  paymentReference?: string;
  notes?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class CommissionEntry {
  readonly id: string;
  readonly companyId: string;
  readonly salespersonId: string;
  readonly sourceType: CommissionSourceType;
  readonly sourceId: string;
  readonly sourceNumber: string;
  readonly customerId: string;
  customerName: string;
  readonly invoiceDate: string;
  readonly baseAmount: number;
  readonly commissionPct: number;
  /** Recomputed in constructor — roundMoney(baseAmount × commissionPct / 100) */
  readonly commissionAmountBase: number;
  readonly currency: string;
  status: CommissionStatus;
  readonly accruedAt: Date;
  paidAt?: Date;
  paymentReference?: string;
  notes?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: CommissionEntryProps) {
    // --- validation ---
    if (!props.salespersonId?.trim()) {
      throw new Error('CommissionEntry salespersonId is required');
    }
    if (
      props.commissionPct < 0 ||
      props.commissionPct > 100 ||
      Number.isNaN(props.commissionPct)
    ) {
      throw new Error('CommissionEntry commissionPct must be between 0 and 100 inclusive');
    }
    if (props.baseAmount < 0 || Number.isNaN(props.baseAmount)) {
      throw new Error('CommissionEntry baseAmount must be >= 0');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.salespersonId = props.salespersonId;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId;
    this.sourceNumber = props.sourceNumber;
    this.customerId = props.customerId;
    this.customerName = props.customerName;
    this.invoiceDate = props.invoiceDate;
    this.baseAmount = props.baseAmount;
    this.commissionPct = props.commissionPct;
    // Always recompute — never trust a caller-supplied value
    this.commissionAmountBase = roundMoney((this.baseAmount * this.commissionPct) / 100);
    this.currency = props.currency;
    this.status = props.status;
    this.accruedAt = props.accruedAt;
    this.paidAt = props.paidAt;
    this.paymentReference = props.paymentReference;
    this.notes = props.notes;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  // -------------------------------------------------------------------------
  // State-transition methods
  // -------------------------------------------------------------------------

  /**
   * Mark this commission as paid.
   * Throws if the current status is not ACCRUED.
   */
  markPaid(paidAt: Date, paymentReference?: string): void {
    if (this.status !== 'ACCRUED') {
      throw new Error(
        `Cannot mark CommissionEntry as PAID — current status is "${this.status}"`
      );
    }
    this.status = 'PAID';
    this.paidAt = paidAt;
    if (paymentReference !== undefined) {
      this.paymentReference = paymentReference;
    }
    this.updatedAt = new Date();
  }

  /**
   * Cancel this commission.
   * Throws if the current status is PAID (paid commissions cannot be cancelled).
   */
  cancel(): void {
    if (this.status === 'PAID') {
      throw new Error(
        `Cannot cancel CommissionEntry — it has already been PAID`
      );
    }
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      salespersonId: this.salespersonId,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceNumber: this.sourceNumber,
      customerId: this.customerId,
      customerName: this.customerName,
      invoiceDate: this.invoiceDate,
      baseAmount: this.baseAmount,
      commissionPct: this.commissionPct,
      commissionAmountBase: this.commissionAmountBase,
      currency: this.currency,
      status: this.status,
      accruedAt: this.accruedAt.toISOString(),
      paidAt: this.paidAt ? this.paidAt.toISOString() : null,
      paymentReference: this.paymentReference ?? null,
      notes: this.notes ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): CommissionEntry {
    return new CommissionEntry({
      id: data.id as string,
      companyId: data.companyId as string,
      salespersonId: data.salespersonId as string,
      sourceType: data.sourceType as CommissionSourceType,
      sourceId: data.sourceId as string,
      sourceNumber: data.sourceNumber as string,
      customerId: data.customerId as string,
      customerName: data.customerName as string,
      invoiceDate: data.invoiceDate as string,
      baseAmount: data.baseAmount as number,
      commissionPct: data.commissionPct as number,
      // commissionAmountBase is recomputed in the constructor
      currency: data.currency as string,
      status: data.status as CommissionStatus,
      accruedAt: new Date(data.accruedAt as string),
      paidAt: data.paidAt != null ? new Date(data.paidAt as string) : undefined,
      paymentReference:
        data.paymentReference != null
          ? (data.paymentReference as string)
          : undefined,
      notes: data.notes != null ? (data.notes as string) : undefined,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : undefined,
    });
  }
}
