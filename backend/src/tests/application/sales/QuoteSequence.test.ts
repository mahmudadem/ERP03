import { describe, expect, it, jest } from '@jest/globals';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { IQuoteRepository } from '../../../repository/interfaces/sales/IQuoteRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { CreateQuoteUseCase, ReviseQuoteUseCase, CreateQuoteInput } from '../../../application/sales/use-cases/QuoteUseCases';
import { Quote } from '../../../domain/sales/entities/Quote';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-seq-test';
const CUSTOMER_ID = 'cust-seq-001';

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

// ---------------------------------------------------------------------------
// 1. Creating a quote uses sequence format QT-00001
// ---------------------------------------------------------------------------

describe('Quote sequence numbering', () => {
  it('creating a quote uses sequence format QT-00001', async () => {
    const repo = makeMockRepo();
    const settingsRepo = makeMockSettingsRepo();
    const useCase = new CreateQuoteUseCase(repo, settingsRepo);

    const quote = await useCase.execute(baseCreateInput);

    expect(quote.quoteNumber).toBe('QT-00001');
    expect(settingsRepo.saveSettings).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 2. Creating a second quote advances the sequence to QT-00002
  // ---------------------------------------------------------------------------

  it('creating a second quote advances the sequence to QT-00002', async () => {
    const settings = makeDefaultSalesSettings();
    // After first quote, quoteNumberNextSeq is advanced in-memory.
    // We simulate that by creating the first quote then the second with
    // the same settings object (since the use case mutates it).

    const repo = makeMockRepo();
    const settingsRepo = makeMockSettingsRepo(settings);
    const useCase = new CreateQuoteUseCase(repo, settingsRepo);

    const quote1 = await useCase.execute(baseCreateInput);
    expect(quote1.quoteNumber).toBe('QT-00001');

    // The settings object was mutated in-memory during the first call.
    // Since the mock returns the same object, the second call will get the
    // incremented sequence.
    const quote2 = await useCase.execute(baseCreateInput);
    expect(quote2.quoteNumber).toBe('QT-00002');
  });

  // ---------------------------------------------------------------------------
  // 3. If a number collides (already exists), the generator tries the next number
  // ---------------------------------------------------------------------------

  it('if a number collides, the generator tries the next number', async () => {
    const settings = makeDefaultSalesSettings();
    const repo = makeMockRepo();

    // Simulate that QT-00001 already exists in the repo
    const existingQuote = new Quote({
      id: 'q-existing',
      companyId: COMPANY_ID,
      quoteNumber: 'QT-00001',
      customerId: CUSTOMER_ID,
      customerName: 'Acme Corp',
      status: 'DRAFT',
      version: 1,
      quoteDate: '2026-05-20',
      currency: 'USD',
      exchangeRate: 1,
      lines: [{
        lineId: 'line-existing',
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
      }],
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

    // getByNumber returns the existing quote for 'QT-00001' but null for 'QT-00002'
    let getByNumberCallCount = 0;
    const getByNumberMock = jest.fn<IQuoteRepository['getByNumber']>().mockImplementation(
      (_companyId: string, quoteNumber: string) => {
        getByNumberCallCount++;
        if (quoteNumber === 'QT-00001') return Promise.resolve(existingQuote);
        return Promise.resolve(null);
      }
    );

    const repoWithCollision: IQuoteRepository = {
      ...repo,
      getByNumber: getByNumberMock,
    };

    const settingsRepo = makeMockSettingsRepo(settings);
    const useCase = new CreateQuoteUseCase(repoWithCollision, settingsRepo);

    const quote = await useCase.execute(baseCreateInput);

    // Should have skipped QT-00001 and allocated QT-00002
    expect(quote.quoteNumber).toBe('QT-00002');
    expect(getByNumberCallCount).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // 4. Custom prefix from settings is respected (e.g., QUO-00001)
  // ---------------------------------------------------------------------------

  it('custom prefix from settings is respected', async () => {
    const settings = makeDefaultSalesSettings();
    settings.quoteNumberPrefix = 'QUO';
    settings.quoteNumberNextSeq = 1;

    const repo = makeMockRepo();
    const settingsRepo = makeMockSettingsRepo(settings);
    const useCase = new CreateQuoteUseCase(repo, settingsRepo);

    const quote = await useCase.execute(baseCreateInput);

    expect(quote.quoteNumber).toBe('QUO-00001');
  });

  // ---------------------------------------------------------------------------
  // 5. ReviseQuoteUseCase also uses sequence numbering
  // ---------------------------------------------------------------------------

  it('ReviseQuoteUseCase uses sequence numbering for the new quote', async () => {
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
      lines: [{
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
      }],
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

    const settings = makeDefaultSalesSettings();
    // Simulate that sequence 1 is already used
    settings.quoteNumberNextSeq = 2;

    const settingsRepo = makeMockSettingsRepo(settings);
    const useCase = new ReviseQuoteUseCase(repo, settingsRepo);
    const newQuote = await useCase.execute(COMPANY_ID, 'q-old');

    expect(newQuote.quoteNumber).toBe('QT-00002');
    expect(settingsRepo.saveSettings).toHaveBeenCalled();
  });
});