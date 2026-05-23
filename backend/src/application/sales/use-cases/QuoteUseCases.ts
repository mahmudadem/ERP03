import { randomUUID } from 'crypto';
import { Quote, QuoteLine } from '../../../domain/sales/entities/Quote';
import { IQuoteRepository } from '../../../repository/interfaces/sales/IQuoteRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import {
  calculateSalesInvoiceLineAmounts,
  calculateSalesInvoiceTotals,
} from '../services/SalesInvoiceCalculationService';
import { CreateSalesOrderUseCase, CreateSalesOrderInput, generateUniqueDocumentNumber } from './SalesOrderUseCases';
import { CreateSalesInvoiceUseCase, CreateSalesInvoiceInput } from './SalesInvoiceUseCases';

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Input interfaces
// ---------------------------------------------------------------------------

export interface QuoteLineInput {
  lineId?: string;
  lineNo?: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  quotedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
  taxCodeId?: string;
  taxRate?: number;
  description?: string;
}

export interface CreateQuoteInput {
  companyId: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  quoteDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: QuoteLineInput[];
  notes?: string;
  createdBy: string;
}

export interface UpdateQuoteInput {
  companyId: string;
  id: string;
  customerId?: string;
  customerName?: string;
  salespersonId?: string;
  quoteDate?: string;
  validUntil?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: QuoteLineInput[];
  notes?: string;
}

export interface ListQuotesFilters {
  status?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQuoteLine(input: QuoteLineInput, index: number, exchangeRate: number): QuoteLine {
  const taxRate = input.taxRate ?? 0;
  const calc = calculateSalesInvoiceLineAmounts({
    invoicedQty: input.quotedQty,
    unitPriceDoc: input.unitPriceDoc,
    exchangeRate,
    taxRate,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountAmountDoc: input.discountAmountDoc,
  });

  return {
    lineId: input.lineId || randomUUID(),
    lineNo: input.lineNo ?? index + 1,
    itemId: input.itemId,
    itemCode: input.itemCode,
    itemName: input.itemName,
    quotedQty: input.quotedQty,
    uomId: input.uomId,
    uom: input.uom,
    unitPriceDoc: input.unitPriceDoc,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountAmountDoc: calc.discountAmountDoc,
    taxCodeId: input.taxCodeId,
    taxRate,
    taxAmountDoc: calc.taxAmountDoc,
    taxAmountBase: calc.taxAmountBase,
    grossLineTotalDoc: calc.grossLineTotalDoc,
    discountAmountBase: calc.discountAmountBase,
    lineTotalDoc: calc.lineTotalDoc,
    unitPriceBase: calc.unitPriceBase,
    lineTotalBase: calc.lineTotalBase,
    description: input.description,
  };
}

// ---------------------------------------------------------------------------
// CreateQuoteUseCase
// ---------------------------------------------------------------------------

export class CreateQuoteUseCase {
  constructor(
    private readonly quoteRepo: IQuoteRepository,
    private readonly salesSettingsRepo: ISalesSettingsRepository
  ) {}

  async execute(input: CreateQuoteInput): Promise<Quote> {
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error('Quote must contain at least one line');
    }

    const settings = await this.salesSettingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Sales settings not found');

    const lines = input.lines.map((l, i) => buildQuoteLine(l, i, input.exchangeRate));
    const totals = calculateSalesInvoiceTotals(
      lines.map((l) => ({
        lineTotalDoc: l.lineTotalDoc,
        lineTotalBase: l.lineTotalBase,
        taxAmountDoc: l.taxAmountDoc,
        taxAmountBase: l.taxAmountBase,
      }))
    );

    const now = new Date();
    const quoteNumber = await generateUniqueDocumentNumber(settings, 'QT', async (candidate: string) => {
      const existing = await this.quoteRepo.getByNumber(input.companyId, candidate);
      return !!existing;
    });

    const quote = new Quote({
      id: randomUUID(),
      companyId: input.companyId,
      quoteNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      salespersonId: input.salespersonId,
      status: 'DRAFT',
      version: 1,
      originQuoteId: undefined,
      quoteDate: input.quoteDate,
      validUntil: input.validUntil,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      lines,
      subtotalDoc: totals.subtotalDoc,
      taxTotalDoc: totals.taxTotalDoc,
      grandTotalDoc: totals.grandTotalDoc,
      subtotalBase: totals.subtotalBase,
      taxTotalBase: totals.taxTotalBase,
      grandTotalBase: totals.grandTotalBase,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.quoteRepo.create(quote);
    await this.salesSettingsRepo.saveSettings(settings);
    return quote;
  }
}

// ---------------------------------------------------------------------------
// UpdateQuoteUseCase
// ---------------------------------------------------------------------------

export class UpdateQuoteUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(input: UpdateQuoteInput): Promise<Quote> {
    const current = await this.quoteRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Quote not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only DRAFT quotes can be updated');
    }

    const exchangeRate = input.exchangeRate ?? current.exchangeRate;
    const rawLines: QuoteLineInput[] = input.lines
      ? input.lines
      : current.lines.map((l) => ({
          lineId: l.lineId,
          lineNo: l.lineNo,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          quotedQty: l.quotedQty,
          uomId: l.uomId,
          uom: l.uom,
          unitPriceDoc: l.unitPriceDoc,
          discountType: l.discountType,
          discountValue: l.discountValue,
          discountAmountDoc: l.discountAmountDoc,
          taxCodeId: l.taxCodeId,
          taxRate: l.taxRate,
          description: l.description,
        }));

    const lines = rawLines.map((l, i) => buildQuoteLine(l, i, exchangeRate));
    const totals = calculateSalesInvoiceTotals(
      lines.map((l) => ({
        lineTotalDoc: l.lineTotalDoc,
        lineTotalBase: l.lineTotalBase,
        taxAmountDoc: l.taxAmountDoc,
        taxAmountBase: l.taxAmountBase,
      }))
    );

    const updated = new Quote({
      id: current.id,
      companyId: current.companyId,
      quoteNumber: current.quoteNumber,
      customerId: input.customerId ?? current.customerId,
      customerName: input.customerName ?? current.customerName,
      salespersonId: input.salespersonId ?? current.salespersonId,
      status: current.status,
      version: current.version,
      originQuoteId: current.originQuoteId,
      quoteDate: input.quoteDate ?? current.quoteDate,
      validUntil: input.validUntil ?? current.validUntil,
      currency: input.currency ?? current.currency,
      exchangeRate,
      lines,
      subtotalDoc: totals.subtotalDoc,
      taxTotalDoc: totals.taxTotalDoc,
      grandTotalDoc: totals.grandTotalDoc,
      subtotalBase: totals.subtotalBase,
      taxTotalBase: totals.taxTotalBase,
      grandTotalBase: totals.grandTotalBase,
      notes: input.notes ?? current.notes,
      convertedToType: current.convertedToType,
      convertedToId: current.convertedToId,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    });

    await this.quoteRepo.update(updated);
    return updated;
  }
}

// ---------------------------------------------------------------------------
// GetQuoteUseCase
// ---------------------------------------------------------------------------

export class GetQuoteUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(companyId: string, id: string): Promise<Quote> {
    const quote = await this.quoteRepo.getById(companyId, id);
    if (!quote) throw new Error(`Quote not found: ${id}`);
    return quote;
  }
}

// ---------------------------------------------------------------------------
// ListQuotesUseCase
// ---------------------------------------------------------------------------

export class ListQuotesUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(companyId: string, filters: ListQuotesFilters = {}): Promise<Quote[]> {
    return this.quoteRepo.list(companyId, {
      status: filters.status,
      customerId: filters.customerId,
      limit: filters.limit,
      offset: filters.offset,
    });
  }
}

// ---------------------------------------------------------------------------
// DeleteQuoteUseCase
// ---------------------------------------------------------------------------

export class DeleteQuoteUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(companyId: string, id: string): Promise<void> {
    const quote = await this.quoteRepo.getById(companyId, id);
    if (!quote) throw new Error(`Quote not found: ${id}`);
    if (quote.status !== 'DRAFT') {
      throw new Error('Only DRAFT quotes can be deleted');
    }
    await this.quoteRepo.delete(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// SendQuoteUseCase
// ---------------------------------------------------------------------------

export class SendQuoteUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(companyId: string, id: string): Promise<Quote> {
    const quote = await this.quoteRepo.getById(companyId, id);
    if (!quote) throw new Error(`Quote not found: ${id}`);
    quote.markSent();
    await this.quoteRepo.update(quote);
    return quote;
  }
}

// ---------------------------------------------------------------------------
// AcceptQuoteUseCase
// ---------------------------------------------------------------------------

export class AcceptQuoteUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(companyId: string, id: string): Promise<Quote> {
    const quote = await this.quoteRepo.getById(companyId, id);
    if (!quote) throw new Error(`Quote not found: ${id}`);
    quote.markAccepted();
    await this.quoteRepo.update(quote);
    return quote;
  }
}

// ---------------------------------------------------------------------------
// RejectQuoteUseCase
// ---------------------------------------------------------------------------

export class RejectQuoteUseCase {
  constructor(private readonly quoteRepo: IQuoteRepository) {}

  async execute(companyId: string, id: string): Promise<Quote> {
    const quote = await this.quoteRepo.getById(companyId, id);
    if (!quote) throw new Error(`Quote not found: ${id}`);
    quote.markRejected();
    await this.quoteRepo.update(quote);
    return quote;
  }
}

// ---------------------------------------------------------------------------
// ReviseQuoteUseCase
// ---------------------------------------------------------------------------
// Creates a new Quote that is a clone with version + 1 and status DRAFT.
// The old quote is marked REJECTED (superseded by the revision).
// ---------------------------------------------------------------------------

export class ReviseQuoteUseCase {
  constructor(
    private readonly quoteRepo: IQuoteRepository,
    private readonly salesSettingsRepo: ISalesSettingsRepository
  ) {}

  async execute(companyId: string, id: string): Promise<Quote> {
    const old = await this.quoteRepo.getById(companyId, id);
    if (!old) throw new Error(`Quote not found: ${id}`);

    const settings = await this.salesSettingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales settings not found');

    const now = new Date();
    const newQuoteNumber = await generateUniqueDocumentNumber(settings, 'QT', async (candidate: string) => {
      const existing = await this.quoteRepo.getByNumber(companyId, candidate);
      return !!existing;
    });

    const newQuote = new Quote({
      id: randomUUID(),
      companyId: old.companyId,
      quoteNumber: newQuoteNumber,
      customerId: old.customerId,
      customerName: old.customerName,
      salespersonId: old.salespersonId,
      status: 'DRAFT',
      version: old.version + 1,
      originQuoteId: old.originQuoteId ?? old.id,
      quoteDate: old.quoteDate,
      validUntil: old.validUntil,
      currency: old.currency,
      exchangeRate: old.exchangeRate,
      lines: old.lines.map((l) => ({ ...l, lineId: randomUUID() })),
      subtotalDoc: old.subtotalDoc,
      taxTotalDoc: old.taxTotalDoc,
      grandTotalDoc: old.grandTotalDoc,
      subtotalBase: old.subtotalBase,
      taxTotalBase: old.taxTotalBase,
      grandTotalBase: old.grandTotalBase,
      notes: old.notes,
      createdBy: old.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Mark the old quote as REJECTED (superseded)
    old.markRejected();

    await this.quoteRepo.update(old);
    await this.quoteRepo.create(newQuote);
    await this.salesSettingsRepo.saveSettings(settings);

    return newQuote;
  }
}

// ---------------------------------------------------------------------------
// ConvertQuoteToSalesOrderUseCase
// ---------------------------------------------------------------------------
// Maps quote lines to CreateSalesOrderInput.lines.
// Required fields that have no direct quote equivalent are given sensible defaults
// with TODO comments.
// ---------------------------------------------------------------------------

export class ConvertQuoteToSalesOrderUseCase {
  constructor(
    private readonly quoteRepo: IQuoteRepository,
    private readonly createSalesOrderUseCase: CreateSalesOrderUseCase
  ) {}

  async execute(companyId: string, quoteId: string): Promise<{ quote: Quote; salesOrderId: string }> {
    const quote = await this.quoteRepo.getById(companyId, quoteId);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);
    if (quote.status !== 'ACCEPTED') {
      throw new Error(`Quote must be ACCEPTED to convert to a Sales Order (current: ${quote.status})`);
    }

    const soInput: CreateSalesOrderInput = {
      companyId: quote.companyId,
      customerId: quote.customerId,
      orderDate: quote.quoteDate,
      // TODO: expectedDeliveryDate — no equivalent on Quote; omitted
      currency: quote.currency,
      exchangeRate: quote.exchangeRate,
      lines: quote.lines.map((l) => ({
        lineId: randomUUID(),
        itemId: l.itemId,
        orderedQty: l.quotedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        taxCodeId: l.taxCodeId,
        // TODO: warehouseId — not captured on QuoteLine; omitted
        description: l.description,
      })),
      notes: quote.notes,
      createdBy: quote.createdBy,
    };

    const so = await this.createSalesOrderUseCase.execute(soInput);

    quote.markConverted('SALES_ORDER', so.id);
    await this.quoteRepo.update(quote);

    return { quote, salesOrderId: so.id };
  }
}

// ---------------------------------------------------------------------------
// ConvertQuoteToSalesInvoiceUseCase
// ---------------------------------------------------------------------------
// Maps quote lines to CreateSalesInvoiceInput using the 'direct' persona so that
// CreateSalesInvoiceUseCase does not require a linked Sales Order.
// ---------------------------------------------------------------------------

export class ConvertQuoteToSalesInvoiceUseCase {
  constructor(
    private readonly quoteRepo: IQuoteRepository,
    private readonly createSalesInvoiceUseCase: CreateSalesInvoiceUseCase
  ) {}

  async execute(companyId: string, quoteId: string): Promise<{ quote: Quote; salesInvoiceId: string }> {
    const quote = await this.quoteRepo.getById(companyId, quoteId);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);
    if (quote.status !== 'ACCEPTED') {
      throw new Error(`Quote must be ACCEPTED to convert to a Sales Invoice (current: ${quote.status})`);
    }

    const siInput: CreateSalesInvoiceInput = {
      companyId: quote.companyId,
      persona: 'direct',             // direct invoice — no linked SO
      customerId: quote.customerId,
      invoiceDate: quote.quoteDate,
      // TODO: dueDate — no equivalent on Quote; omitted (sales settings apply default terms)
      currency: quote.currency,
      exchangeRate: quote.exchangeRate,
      lines: quote.lines.map((l) => ({
        lineId: randomUUID(),
        itemId: l.itemId,
        invoicedQty: l.quotedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        discountType: l.discountType,
        discountValue: l.discountValue,
        discountAmountDoc: l.discountAmountDoc,
        taxCodeId: l.taxCodeId,
        // TODO: warehouseId — not captured on QuoteLine; omitted
        description: l.description,
      })),
      notes: quote.notes,
      createdBy: quote.createdBy,
    };

    const si = await this.createSalesInvoiceUseCase.execute(siInput);

    quote.markConverted('SALES_INVOICE', si.id);
    await this.quoteRepo.update(quote);

    return { quote, salesInvoiceId: si.id };
  }
}
