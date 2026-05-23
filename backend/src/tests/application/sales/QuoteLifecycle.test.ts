import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Quote, QuoteLine } from '../../../domain/sales/entities/Quote';
import { IQuoteRepository } from '../../../repository/interfaces/sales/IQuoteRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import {
  CreateQuoteUseCase,
  AcceptQuoteUseCase,
  ReviseQuoteUseCase,
  ConvertQuoteToSalesOrderUseCase,
  CreateQuoteInput,
} from '../../../application/sales/use-cases/QuoteUseCases';
import { CreateSalesOrderUseCase } from '../../../application/sales/use-cases/SalesOrderUseCases';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-quote-test';
const CUSTOMER_ID = 'cust-001';

const lineInput = {
  itemId: 'item-001',
  itemCode: 'SKU-001',
  itemName: 'Widget A',
  quotedQty: 10,
  uom: 'EA',
  unitPriceDoc: 100,
  taxRate: 0.1,
};

const baseCreateInput: CreateQuoteInput = {
  companyId: COMPANY_ID,
  customerId: CUSTOMER_ID,
  customerName: 'Acme Corp',
  quoteDate: '2026-05-20',
  validUntil: '2026-06-20',
  currency: 'USD',
  exchangeRate: 1,
  lines: [lineInput],
  createdBy: 'user-test',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAcceptedQuote(): Quote {
  const q = new Quote({
    id: 'q-001',
    companyId: COMPANY_ID,
    quoteNumber: 'Q-111',
    customerId: CUSTOMER_ID,
    customerName: 'Acme Corp',
    status: 'SENT',
    version: 1,
    quoteDate: '2026-05-20',
    currency: 'USD',
    exchangeRate: 1,
    lines: [makeQuoteLine()],
    subtotalDoc: 1000,
    taxTotalDoc: 100,
    grandTotalDoc: 1100,
    subtotalBase: 1000,
    taxTotalBase: 100,
    grandTotalBase: 1100,
    createdBy: 'user-test',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  q.markAccepted();
  return q;
}

function makeQuoteLine(): QuoteLine {
  return {
    lineId: 'line-001',
    lineNo: 1,
    itemId: 'item-001',
    itemCode: 'SKU-001',
    itemName: 'Widget A',
    quotedQty: 10,
    uom: 'EA',
    unitPriceDoc: 100,
    taxRate: 0.1,
    taxAmountDoc: 100,
    taxAmountBase: 100,
    grossLineTotalDoc: 1000,
    lineTotalDoc: 1000,
    unitPriceBase: 100,
    lineTotalBase: 1000,
  };
}

function makeMockRepo(overrides: Partial<IQuoteRepository> = {}): IQuoteRepository {
  return {
    create: jest.fn<IQuoteRepository['create']>().mockResolvedValue(undefined),
    update: jest.fn<IQuoteRepository['update']>().mockResolvedValue(undefined),
    getById: jest.fn<IQuoteRepository['getById']>().mockResolvedValue(null),
    getByNumber: jest.fn<IQuoteRepository['getByNumber']>().mockResolvedValue(null),
    list: jest.fn<IQuoteRepository['list']>().mockResolvedValue([]),
    delete: jest.fn<IQuoteRepository['delete']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeDefaultSalesSettings(companyId: string = COMPANY_ID): SalesSettings {
  return SalesSettings.createDefault(companyId, undefined, 'acc-revenue');
}

function makeMockSettingsRepo(settings?: SalesSettings): ISalesSettingsRepository {
  const s = settings ?? makeDefaultSalesSettings();
  return {
    getSettings: jest.fn<ISalesSettingsRepository['getSettings']>().mockResolvedValue(s),
    saveSettings: jest.fn<ISalesSettingsRepository['saveSettings']>().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// 1. Quote entity constructor validation
// ---------------------------------------------------------------------------

describe('Quote constructor validation', () => {
  it('throws when lines array is empty', () => {
    expect(
      () =>
        new Quote({
          id: 'q-1',
          companyId: COMPANY_ID,
          quoteNumber: 'Q-001',
          customerId: CUSTOMER_ID,
          customerName: 'Acme',
          status: 'DRAFT',
          version: 1,
          quoteDate: '2026-05-20',
          currency: 'USD',
          exchangeRate: 1,
          lines: [],
          subtotalDoc: 0,
          taxTotalDoc: 0,
          grandTotalDoc: 0,
          subtotalBase: 0,
          taxTotalBase: 0,
          grandTotalBase: 0,
          createdBy: 'u',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
    ).toThrow('Quote must contain at least one line');
  });

  it('throws when version is less than 1', () => {
    expect(
      () =>
        new Quote({
          id: 'q-1',
          companyId: COMPANY_ID,
          quoteNumber: 'Q-001',
          customerId: CUSTOMER_ID,
          customerName: 'Acme',
          status: 'DRAFT',
          version: 0,
          quoteDate: '2026-05-20',
          currency: 'USD',
          exchangeRate: 1,
          lines: [makeQuoteLine()],
          subtotalDoc: 0,
          taxTotalDoc: 0,
          grandTotalDoc: 0,
          subtotalBase: 0,
          taxTotalBase: 0,
          grandTotalBase: 0,
          createdBy: 'u',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
    ).toThrow('Quote version must be an integer >= 1');
  });
});

// ---------------------------------------------------------------------------
// 2. State-transition guards on the entity
// ---------------------------------------------------------------------------

describe('Quote.markSent()', () => {
  it('throws when status is not DRAFT', () => {
    const q = new Quote({
      id: 'q-1',
      companyId: COMPANY_ID,
      quoteNumber: 'Q-001',
      customerId: CUSTOMER_ID,
      customerName: 'Acme',
      status: 'SENT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      createdBy: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => q.markSent()).toThrow('Cannot mark quote as SENT from status: SENT');
  });
});

describe('Quote.markAccepted()', () => {
  it('throws when status is not SENT', () => {
    const q = new Quote({
      id: 'q-1',
      companyId: COMPANY_ID,
      quoteNumber: 'Q-001',
      customerId: CUSTOMER_ID,
      customerName: 'Acme',
      status: 'DRAFT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      createdBy: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => q.markAccepted()).toThrow('Cannot mark quote as ACCEPTED from status: DRAFT');
  });
});

describe('Quote.markConverted()', () => {
  it('throws when status is not ACCEPTED', () => {
    const q = new Quote({
      id: 'q-1',
      companyId: COMPANY_ID,
      quoteNumber: 'Q-001',
      customerId: CUSTOMER_ID,
      customerName: 'Acme',
      status: 'SENT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      createdBy: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => q.markConverted('SALES_ORDER', 'so-1')).toThrow(
      'Cannot mark quote as CONVERTED from status: SENT'
    );
  });
});

// ---------------------------------------------------------------------------
// 3. isExpired
// ---------------------------------------------------------------------------

describe('Quote.isExpired()', () => {
  it('returns true when validUntil is past and status is SENT', () => {
    const q = new Quote({
      id: 'q-1',
      companyId: COMPANY_ID,
      quoteNumber: 'Q-001',
      customerId: CUSTOMER_ID,
      customerName: 'Acme',
      status: 'SENT',
      version: 1,
      quoteDate: '2026-05-01',
      validUntil: '2026-05-10',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      createdBy: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(q.isExpired('2026-05-20')).toBe(true);
  });

  it('returns false when status is ACCEPTED (no longer an open offer)', () => {
    const q = makeAcceptedQuote();
    q.validUntil = '2026-05-10';
    expect(q.isExpired('2026-05-20')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. CreateQuoteUseCase
// ---------------------------------------------------------------------------

describe('CreateQuoteUseCase', () => {
  it('produces version 1, status DRAFT, and correct totals', async () => {
    const repo = makeMockRepo();
    const settingsRepo = makeMockSettingsRepo();
    const useCase = new CreateQuoteUseCase(repo, settingsRepo);

    const quote = await useCase.execute(baseCreateInput);

    expect(quote.version).toBe(1);
    expect(quote.status).toBe('DRAFT');
    // 10 qty × $100 = $1000 subtotal; $1000 × 10% = $100 tax; $1100 grand total
    expect(quote.subtotalDoc).toBe(1000);
    expect(quote.taxTotalDoc).toBe(100);
    expect(quote.grandTotalDoc).toBe(1100);
    expect(repo.create).toHaveBeenCalledWith(quote);
    expect(settingsRepo.saveSettings).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. ReviseQuoteUseCase
// ---------------------------------------------------------------------------

describe('ReviseQuoteUseCase', () => {
  it('produces version 2 with originQuoteId set and marks the old quote REJECTED', async () => {
    const oldQuote = new Quote({
      id: 'q-old',
      companyId: COMPANY_ID,
      quoteNumber: 'QT-00001',
      customerId: CUSTOMER_ID,
      customerName: 'Acme Corp',
      status: 'SENT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 1000,
      taxTotalDoc: 100,
      grandTotalDoc: 1100,
      subtotalBase: 1000,
      taxTotalBase: 100,
      grandTotalBase: 1100,
      createdBy: 'user-test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repo = makeMockRepo({
      getById: jest.fn<IQuoteRepository['getById']>().mockResolvedValue(oldQuote),
    });

    const settingsRepo = makeMockSettingsRepo();
    const useCase = new ReviseQuoteUseCase(repo, settingsRepo);
    const newQuote = await useCase.execute(COMPANY_ID, 'q-old');

    // New quote assertions
    expect(newQuote.version).toBe(2);
    expect(newQuote.status).toBe('DRAFT');
    expect(newQuote.originQuoteId).toBe('q-old');
    expect(newQuote.id).not.toBe('q-old');

    // Old quote was updated to REJECTED
    expect(repo.update).toHaveBeenCalledWith(oldQuote);
    expect(oldQuote.status).toBe('REJECTED');

    // New quote was created
    expect(repo.create).toHaveBeenCalledWith(newQuote);
    expect(settingsRepo.saveSettings).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. AcceptQuoteUseCase
// ---------------------------------------------------------------------------

describe('AcceptQuoteUseCase', () => {
  it('moves a SENT quote to ACCEPTED', async () => {
    const sentQuote = new Quote({
      id: 'q-sent',
      companyId: COMPANY_ID,
      quoteNumber: 'Q-200',
      customerId: CUSTOMER_ID,
      customerName: 'Acme Corp',
      status: 'SENT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 1000,
      taxTotalDoc: 100,
      grandTotalDoc: 1100,
      subtotalBase: 1000,
      taxTotalBase: 100,
      grandTotalBase: 1100,
      createdBy: 'user-test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repo = makeMockRepo({
      getById: jest.fn<IQuoteRepository['getById']>().mockResolvedValue(sentQuote),
    });

    const useCase = new AcceptQuoteUseCase(repo);
    const result = await useCase.execute(COMPANY_ID, 'q-sent');

    expect(result.status).toBe('ACCEPTED');
    expect(repo.update).toHaveBeenCalledWith(sentQuote);
  });
});

// ---------------------------------------------------------------------------
// 7. ConvertQuoteToSalesOrderUseCase
// ---------------------------------------------------------------------------

describe('ConvertQuoteToSalesOrderUseCase', () => {
  it('throws when quote is not ACCEPTED', async () => {
    const draftQuote = new Quote({
      id: 'q-draft',
      companyId: COMPANY_ID,
      quoteNumber: 'Q-300',
      customerId: CUSTOMER_ID,
      customerName: 'Acme Corp',
      status: 'DRAFT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [makeQuoteLine()],
      subtotalDoc: 1000,
      taxTotalDoc: 100,
      grandTotalDoc: 1100,
      subtotalBase: 1000,
      taxTotalBase: 100,
      grandTotalBase: 1100,
      createdBy: 'user-test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repo = makeMockRepo({
      getById: jest.fn<IQuoteRepository['getById']>().mockResolvedValue(draftQuote),
    });

    const mockSoUseCase = {
      execute: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'so-1' }),
    } as unknown as CreateSalesOrderUseCase;

    const useCase = new ConvertQuoteToSalesOrderUseCase(repo, mockSoUseCase);

    await expect(useCase.execute(COMPANY_ID, 'q-draft')).rejects.toThrow(
      'Quote must be ACCEPTED to convert to a Sales Order'
    );
  });

  it('happy path: calls SO create use case and marks quote CONVERTED', async () => {
    const acceptedQuote = makeAcceptedQuote();

    const repo = makeMockRepo({
      getById: jest.fn<IQuoteRepository['getById']>().mockResolvedValue(acceptedQuote),
    });

    const mockSoUseCase = {
      execute: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'so-1' }),
    } as unknown as CreateSalesOrderUseCase;

    const useCase = new ConvertQuoteToSalesOrderUseCase(repo, mockSoUseCase);
    const result = await useCase.execute(COMPANY_ID, acceptedQuote.id);

    expect(mockSoUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result.salesOrderId).toBe('so-1');
    expect(result.quote.status).toBe('CONVERTED');
    expect(result.quote.convertedToType).toBe('SALES_ORDER');
    expect(result.quote.convertedToId).toBe('so-1');
    expect(repo.update).toHaveBeenCalledWith(acceptedQuote);
  });
});
