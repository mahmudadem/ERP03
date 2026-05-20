import { CommissionEntry } from '../../../domain/sales/entities/CommissionEntry';
import { ICommissionEntryRepository, CommissionEntryListOptions } from '../../../repository/interfaces/sales/ICommissionEntryRepository';
import { ISalespersonRepository } from '../../../repository/interfaces/sales/ISalespersonRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';

// ---------------------------------------------------------------------------
// AccrueCommissionForInvoiceUseCase
// ---------------------------------------------------------------------------

export interface AccrueCommissionInput {
  companyId: string;
  invoiceId: string;
  accruedAt?: Date;
  createdBy?: string;
}

export class AccrueCommissionForInvoiceUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly salespersonRepo: ISalespersonRepository,
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  /**
   * Accrue a commission entry for a posted sales invoice.
   *
   * Returns null if the invoice has no salespersonId (no-op).
   * Returns the existing entry if one already exists for this invoice
   * (idempotent — prevents duplicate accrual).
   */
  async execute(input: AccrueCommissionInput): Promise<CommissionEntry | null> {
    const invoice = await this.salesInvoiceRepo.getById(
      input.companyId,
      input.invoiceId
    );
    if (!invoice) {
      throw new Error(`SalesInvoice not found: ${input.invoiceId}`);
    }

    // No salesperson on the invoice → nothing to accrue
    if (!invoice.salespersonId) {
      return null;
    }

    // Idempotency guard — return existing entry if accrual already happened
    const existing = await this.commissionEntryRepo.findBySource(
      input.companyId,
      'SALES_INVOICE',
      input.invoiceId
    );
    if (existing) {
      return existing;
    }

    // Look up the salesperson
    const salesperson = await this.salespersonRepo.getById(
      input.companyId,
      invoice.salespersonId
    );
    if (!salesperson) {
      throw new Error(`Salesperson not found: ${invoice.salespersonId}`);
    }
    if (salesperson.status === 'INACTIVE') {
      throw new Error(
        `Cannot accrue commission for inactive salesperson "${salesperson.name}"`
      );
    }

    // Build the commission entry.
    // baseAmount = invoice.grandTotalBase — commission is on the full invoice
    // value including tax, which is the most intuitive basis for sales
    // commission in a B2B ERP context: the salesperson is rewarded on what the
    // customer was charged in full.
    const entry = new CommissionEntry({
      companyId: input.companyId,
      salespersonId: salesperson.id,
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      sourceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      invoiceDate: invoice.invoiceDate,
      baseAmount: invoice.grandTotalBase,
      commissionPct: salesperson.defaultCommissionPct,
      currency: invoice.currency,
      status: 'ACCRUED',
      accruedAt: input.accruedAt ?? new Date(),
      createdBy: input.createdBy ?? 'SYSTEM',
    });

    await this.commissionEntryRepo.create(entry);
    return entry;
  }
}

// ---------------------------------------------------------------------------
// MarkCommissionPaidUseCase
// ---------------------------------------------------------------------------

export interface MarkCommissionPaidInput {
  companyId: string;
  commissionEntryId: string;
  paidAt?: Date;
  paymentReference?: string;
}

export class MarkCommissionPaidUseCase {
  constructor(
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  async execute(input: MarkCommissionPaidInput): Promise<CommissionEntry> {
    const entry = await this.commissionEntryRepo.getById(
      input.companyId,
      input.commissionEntryId
    );
    if (!entry) {
      throw new Error(`CommissionEntry not found: ${input.commissionEntryId}`);
    }

    entry.markPaid(input.paidAt ?? new Date(), input.paymentReference);
    await this.commissionEntryRepo.update(entry);
    return entry;
  }
}

// ---------------------------------------------------------------------------
// CancelCommissionUseCase
// ---------------------------------------------------------------------------

export interface CancelCommissionInput {
  companyId: string;
  commissionEntryId: string;
}

export class CancelCommissionUseCase {
  constructor(
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  async execute(input: CancelCommissionInput): Promise<CommissionEntry> {
    const entry = await this.commissionEntryRepo.getById(
      input.companyId,
      input.commissionEntryId
    );
    if (!entry) {
      throw new Error(`CommissionEntry not found: ${input.commissionEntryId}`);
    }

    entry.cancel();
    await this.commissionEntryRepo.update(entry);
    return entry;
  }
}

// ---------------------------------------------------------------------------
// ListCommissionsUseCase
// ---------------------------------------------------------------------------

export class ListCommissionsUseCase {
  constructor(
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  async execute(
    companyId: string,
    opts?: CommissionEntryListOptions
  ): Promise<CommissionEntry[]> {
    return this.commissionEntryRepo.list(companyId, opts);
  }
}

// ---------------------------------------------------------------------------
// GetSalespersonCommissionTotalsUseCase
// ---------------------------------------------------------------------------

export class GetSalespersonCommissionTotalsUseCase {
  constructor(
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  async execute(
    companyId: string,
    salespersonId: string
  ): Promise<{ accrued: number; paid: number; cancelled: number }> {
    return this.commissionEntryRepo.totalsBySalesperson(companyId, salespersonId);
  }
}

// ---------------------------------------------------------------------------
// GetCommissionEntryUseCase
// ---------------------------------------------------------------------------

export class GetCommissionEntryUseCase {
  constructor(
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  async execute(
    companyId: string,
    id: string
  ): Promise<CommissionEntry | null> {
    return this.commissionEntryRepo.getById(companyId, id);
  }
}
