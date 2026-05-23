import { RecurringInvoiceTemplate } from '../../../domain/sales/entities/RecurringInvoiceTemplate';
import {
  CreateRecurringInvoiceTemplateUseCase,
  UpdateRecurringInvoiceTemplateUseCase,
  PauseRecurringInvoiceTemplateUseCase,
  ResumeRecurringInvoiceTemplateUseCase,
  CancelRecurringInvoiceTemplateUseCase,
  GenerateRecurringInvoicesUseCase,
  CloneInvoiceAsTemplateUseCase,
} from '../../../application/sales/use-cases/RecurringInvoiceUseCases';

const makeTemplate = (overrides: Partial<any> = {}) =>
  new RecurringInvoiceTemplate({
    id: 't1',
    companyId: 'c1',
    name: 'Monthly Rent',
    customerId: 'cust1',
    customerName: 'Tenant Co',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      { itemId: 'item1', itemCode: 'RENT', itemName: 'Monthly Rent', qty: 1, unitPriceDoc: 1000, taxRate: 0 },
    ],
    paymentTermsDays: 30,
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    nextGenerationDate: '2026-02-01',
    status: 'ACTIVE',
    createdBy: 'u1',
    createdAt: new Date('2026-01-01'),
    occurrencesGenerated: 0,
    ...overrides,
  });

describe('RecurringInvoiceTemplate entity', () => {
  it('creates a valid template', () => {
    const t = makeTemplate();
    expect(t.status).toBe('ACTIVE');
    expect(t.frequency).toBe('MONTHLY');
    expect(t.lines.length).toBe(1);
  });

  it('throws on invalid frequency', () => {
    expect(() => makeTemplate({ frequency: 'BIWEEKLY' })).toThrow('Invalid frequency');
  });

  it('throws on empty lines', () => {
    expect(() => makeTemplate({ lines: [] })).toThrow('must have at least one line');
  });

  it('throws on blank name', () => {
    expect(() => makeTemplate({ name: '   ' })).toThrow('name is required');
  });

  it('throws on invalid start date', () => {
    expect(() => makeTemplate({ startDate: 'invalid-date' })).toThrow('startDate must be a valid YYYY-MM-DD date');
  });

  it('throws on non-positive line quantity', () => {
    expect(() => makeTemplate({
      lines: [{ itemId: 'item1', itemCode: 'RENT', itemName: 'Monthly Rent', qty: 0, unitPriceDoc: 1000, taxRate: 0 }],
    })).toThrow('line quantity must be greater than 0');
  });

  it('pause returns new instance with PAUSED status', () => {
    const t = makeTemplate();
    const paused = t.pause('u1', new Date('2026-02-01'));
    expect(t.status).toBe('ACTIVE');
    expect(paused.status).toBe('PAUSED');
    expect(paused.updatedBy).toBe('u1');
  });

  it('resume returns new instance with ACTIVE status', () => {
    const t = makeTemplate({ status: 'PAUSED' });
    const resumed = t.resume('u1', new Date('2026-02-01'));
    expect(resumed.status).toBe('ACTIVE');
  });

  it('cancel returns new instance with CANCELLED status', () => {
    const t = makeTemplate();
    const cancelled = t.cancel('u1', new Date('2026-02-01'));
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('advance increments occurrences and computes next date', () => {
    const t = makeTemplate({ nextGenerationDate: '2026-02-01', occurrencesGenerated: 0 });
    const advanced = t.advance('u1', new Date('2026-02-01'));
    expect(advanced.occurrencesGenerated).toBe(1);
    expect(advanced.nextGenerationDate).toBe('2026-03-01');
  });

  it('advance marks COMPLETED when maxOccurrences reached', () => {
    const t = makeTemplate({ nextGenerationDate: '2026-02-01', occurrencesGenerated: 1, maxOccurrences: 2 });
    const advanced = t.advance('u1', new Date('2026-02-01'));
    expect(advanced.occurrencesGenerated).toBe(2);
    expect(advanced.status).toBe('COMPLETED');
  });

  it('advance marks COMPLETED when endDate passed', () => {
    const t = makeTemplate({ nextGenerationDate: '2026-02-01', endDate: '2026-02-15' });
    const advanced = t.advance('u1', new Date('2026-02-01'));
    expect(advanced.nextGenerationDate).toBe('2026-02-01');
    expect(advanced.status).toBe('COMPLETED');
  });

  it('serializes and deserializes via toJSON/fromJSON', () => {
    const t = makeTemplate();
    const json = t.toJSON();
    const restored = RecurringInvoiceTemplate.fromJSON(json);
    expect(restored.id).toBe(t.id);
    expect(restored.customerId).toBe(t.customerId);
    expect(restored.lines.length).toBe(t.lines.length);
    expect(restored.frequency).toBe(t.frequency);
  });
});

describe('CreateRecurringInvoiceTemplateUseCase', () => {
  const templateRepo: any = { create: jest.fn() };
  const settingsRepo: any = {
    getSettings: jest.fn().mockResolvedValue({
      defaultPaymentTermsDays: 30,
      siNumberPrefix: 'SI',
      siNumberNextSeq: 1,
    }),
  };

  it('creates a template with provided data', async () => {
    const useCase = new CreateRecurringInvoiceTemplateUseCase(templateRepo, settingsRepo);
    const result = await useCase.execute('c1', 'u1', {
      name: 'Monthly Service',
      customerId: 'cust1',
      customerName: 'Client Inc',
      currency: 'USD',
      lines: [{ itemId: 'item1', itemCode: 'SVC', itemName: 'Service', qty: 1, unitPriceDoc: 500, taxRate: 0 }],
      frequency: 'MONTHLY',
      dayOfMonth: 15,
      startDate: '2026-03-01',
    });

    expect(templateRepo.create).toHaveBeenCalled();
    expect(result.status).toBe('ACTIVE');
    expect(result.frequency).toBe('MONTHLY');
  });
});

describe('PauseRecurringInvoiceTemplateUseCase', () => {
  const templateRepo: any = { findById: jest.fn(), update: jest.fn() };

  it('pauses an active template', async () => {
    templateRepo.findById.mockResolvedValue(makeTemplate());
    const useCase = new PauseRecurringInvoiceTemplateUseCase(templateRepo);
    const result = await useCase.execute('c1', 'u1', 't1');
    expect(result.status).toBe('PAUSED');
    expect(templateRepo.update).toHaveBeenCalled();
  });

  it('throws if template is not active', async () => {
    templateRepo.findById.mockResolvedValue(makeTemplate({ status: 'PAUSED' }));
    const useCase = new PauseRecurringInvoiceTemplateUseCase(templateRepo);
    await expect(useCase.execute('c1', 'u1', 't1')).rejects.toThrow('Template is not active');
  });
});

describe('UpdateRecurringInvoiceTemplateUseCase', () => {
  const templateRepo: any = { findById: jest.fn(), update: jest.fn() };

  it('rejects empty lines update', async () => {
    templateRepo.findById.mockResolvedValue(makeTemplate());
    const useCase = new UpdateRecurringInvoiceTemplateUseCase(templateRepo);
    await expect(useCase.execute('c1', 'u1', 't1', { lines: [] as any })).rejects.toThrow(
      'must contain at least one line'
    );
  });
});

describe('ResumeRecurringInvoiceTemplateUseCase', () => {
  const templateRepo: any = { findById: jest.fn(), update: jest.fn() };

  it('resumes a paused template', async () => {
    templateRepo.findById.mockResolvedValue(makeTemplate({ status: 'PAUSED' }));
    const useCase = new ResumeRecurringInvoiceTemplateUseCase(templateRepo);
    const result = await useCase.execute('c1', 'u1', 't1');
    expect(result.status).toBe('ACTIVE');
  });

  it('throws if template is not paused', async () => {
    templateRepo.findById.mockResolvedValue(makeTemplate({ status: 'ACTIVE' }));
    const useCase = new ResumeRecurringInvoiceTemplateUseCase(templateRepo);
    await expect(useCase.execute('c1', 'u1', 't1')).rejects.toThrow('Template is not paused');
  });
});

describe('CancelRecurringInvoiceTemplateUseCase', () => {
  const templateRepo: any = { findById: jest.fn(), update: jest.fn() };

  it('cancels a template', async () => {
    templateRepo.findById.mockResolvedValue(makeTemplate());
    const useCase = new CancelRecurringInvoiceTemplateUseCase(templateRepo);
    const result = await useCase.execute('c1', 'u1', 't1');
    expect(result.status).toBe('CANCELLED');
  });
});

describe('GenerateRecurringInvoicesUseCase', () => {
  const templateRepo: any = { listDue: jest.fn(), update: jest.fn() };
  const invoiceRepo: any = { create: jest.fn() };
  const settingsRepo: any = {
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    settingsRepo.getSettings.mockResolvedValue({
      siNumberPrefix: 'SI',
      siNumberNextSeq: 1,
    });
  });

  it('creates draft invoices from due templates and advances them', async () => {
    const tmpl = makeTemplate({ nextGenerationDate: '2026-02-01', occurrencesGenerated: 0 });
    templateRepo.listDue.mockResolvedValue([tmpl]);

    const useCase = new GenerateRecurringInvoicesUseCase(templateRepo, invoiceRepo, settingsRepo);
    const result = await useCase.execute('c1', 'u1', '2026-02-02');

    expect(result.length).toBe(1);
    expect(result[0].status).toBe('DRAFT');
    expect(invoiceRepo.create).toHaveBeenCalled();
    expect(templateRepo.update).toHaveBeenCalled();
    expect(settingsRepo.saveSettings).toHaveBeenCalled();
  });

  it('returns empty array when no templates are due', async () => {
    templateRepo.listDue.mockResolvedValue([]);
    const useCase = new GenerateRecurringInvoicesUseCase(templateRepo, invoiceRepo, settingsRepo);
    const result = await useCase.execute('c1', 'u1', '2026-02-02');
    expect(result.length).toBe(0);
    expect(settingsRepo.saveSettings).not.toHaveBeenCalled();
  });
});

describe('CloneInvoiceAsTemplateUseCase', () => {
  const templateRepo: any = { create: jest.fn() };
  const invoiceRepo: any = {
    getById: jest.fn().mockResolvedValue({
      id: 'si1',
      companyId: 'c1',
      customerId: 'cust1',
      customerName: 'Client Inc',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        { lineId: 'l1', itemId: 'item1', itemCode: 'SVC', itemName: 'Service', invoicedQty: 2, unitPriceDoc: 250, taxRate: 0 },
      ],
      paymentTermsDays: 30,
      notes: 'Original invoice',
    }),
  };

  it('creates a template from an existing invoice', async () => {
    const useCase = new CloneInvoiceAsTemplateUseCase(templateRepo, invoiceRepo);
    const result = await useCase.execute('c1', 'u1', 'si1', 'Cloned Monthly', 'MONTHLY', 1, undefined, '2026-03-01');

    expect(templateRepo.create).toHaveBeenCalled();
    expect(result.sourceInvoiceId).toBe('si1');
    expect(result.name).toBe('Cloned Monthly');
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].qty).toBe(2);
  });
});
