import { v4 as uuidv4 } from 'uuid';
import { RecurringInvoiceTemplate, RecurrenceFrequency, RecurringInvoiceLine } from '../../../domain/sales/entities/RecurringInvoiceTemplate';
import { IRecurringInvoiceTemplateRepository } from '../../../repository/interfaces/sales/IRecurringInvoiceTemplateRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { generateUniqueDocumentNumber } from './SalesOrderUseCases';
import { INumberingEngine } from '../../system-core/contracts/INumberingEngine';

export interface CreateRecurringInvoiceTemplateInput {
  name: string;
  sourceInvoiceId?: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate?: number;
  lines: {
    itemId: string;
    itemCode: string;
    itemName: string;
    qty: number;
    unitPriceDoc: number;
    taxCodeId?: string;
    taxCode?: string;
    taxRate: number;
    description?: string;
  }[];
  notes?: string;
  paymentTermsDays?: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
}

export class CreateRecurringInvoiceTemplateUseCase {
  constructor(
    private readonly templateRepo: IRecurringInvoiceTemplateRepository,
    private readonly settingsRepo: ISalesSettingsRepository
  ) {}

  async execute(companyId: string, userId: string, input: CreateRecurringInvoiceTemplateInput): Promise<RecurringInvoiceTemplate> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales settings not found for this company');

    const exchangeRate = input.exchangeRate ?? 1;
    const nextDate = input.startDate;

    const template = new RecurringInvoiceTemplate({
      id: uuidv4(),
      companyId,
      name: input.name,
      sourceInvoiceId: input.sourceInvoiceId,
      customerId: input.customerId,
      customerName: input.customerName,
      currency: input.currency,
      exchangeRate,
      lines: input.lines as RecurringInvoiceLine[],
      notes: input.notes,
      paymentTermsDays: input.paymentTermsDays ?? settings.defaultPaymentTermsDays ?? 0,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth,
      dayOfWeek: input.dayOfWeek,
      startDate: input.startDate,
      endDate: input.endDate,
      maxOccurrences: input.maxOccurrences,
      occurrencesGenerated: 0,
      nextGenerationDate: nextDate,
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: new Date(),
    });

    await this.templateRepo.create(template);
    return template;
  }
}

export class UpdateRecurringInvoiceTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringInvoiceTemplateRepository) {}

  async execute(
    companyId: string,
    userId: string,
    id: string,
    partial: Partial<CreateRecurringInvoiceTemplateInput>
  ): Promise<RecurringInvoiceTemplate> {
    const existing = await this.templateRepo.findById(companyId, id);
    if (!existing) throw new Error('Recurring invoice template not found');
    if (existing.status === 'CANCELLED') throw new Error('Cannot update a cancelled template');
    if (partial.lines && Array.isArray(partial.lines) && partial.lines.length === 0) {
      throw new Error('Recurring invoice template must contain at least one line');
    }

    const updated = new RecurringInvoiceTemplate({
      id: existing.id,
      companyId: existing.companyId,
      name: partial.name || existing.name,
      customerId: partial.customerId || existing.customerId,
      customerName: partial.customerName || existing.customerName,
      currency: partial.currency || existing.currency,
      exchangeRate: partial.exchangeRate ?? existing.exchangeRate,
      lines: (partial.lines as RecurringInvoiceLine[] | undefined) || existing.lines,
      notes: partial.notes !== undefined ? partial.notes : existing.notes,
      paymentTermsDays: partial.paymentTermsDays ?? existing.paymentTermsDays,
      frequency: (partial.frequency as RecurrenceFrequency) || existing.frequency,
      dayOfMonth: partial.dayOfMonth !== undefined ? partial.dayOfMonth : existing.dayOfMonth,
      dayOfWeek: partial.dayOfWeek !== undefined ? partial.dayOfWeek : existing.dayOfWeek,
      startDate: partial.startDate || existing.startDate,
      endDate: partial.endDate !== undefined ? partial.endDate : existing.endDate,
      maxOccurrences: partial.maxOccurrences !== undefined ? partial.maxOccurrences : existing.maxOccurrences,
      occurrencesGenerated: existing.occurrencesGenerated,
      nextGenerationDate: existing.nextGenerationDate,
      status: existing.status,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      updatedBy: userId,
    });

    await this.templateRepo.update(updated);
    return updated;
  }
}

export class PauseRecurringInvoiceTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringInvoiceTemplateRepository) {}

  async execute(companyId: string, userId: string, id: string): Promise<RecurringInvoiceTemplate> {
    const tmpl = await this.templateRepo.findById(companyId, id);
    if (!tmpl) throw new Error('Recurring invoice template not found');
    if (tmpl.status !== 'ACTIVE') throw new Error('Template is not active');
    const paused = tmpl.pause(userId, new Date());
    await this.templateRepo.update(paused);
    return paused;
  }
}

export class ResumeRecurringInvoiceTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringInvoiceTemplateRepository) {}

  async execute(companyId: string, userId: string, id: string): Promise<RecurringInvoiceTemplate> {
    const tmpl = await this.templateRepo.findById(companyId, id);
    if (!tmpl) throw new Error('Recurring invoice template not found');
    if (tmpl.status !== 'PAUSED') throw new Error('Template is not paused');
    const resumed = tmpl.resume(userId, new Date());
    await this.templateRepo.update(resumed);
    return resumed;
  }
}

export class CancelRecurringInvoiceTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringInvoiceTemplateRepository) {}

  async execute(companyId: string, userId: string, id: string): Promise<RecurringInvoiceTemplate> {
    const tmpl = await this.templateRepo.findById(companyId, id);
    if (!tmpl) throw new Error('Recurring invoice template not found');
    if (tmpl.status === 'CANCELLED') throw new Error('Template is already cancelled');
    const cancelled = tmpl.cancel(userId, new Date());
    await this.templateRepo.update(cancelled);
    return cancelled;
  }
}

export class GenerateRecurringInvoicesUseCase {
  constructor(
    private readonly templateRepo: IRecurringInvoiceTemplateRepository,
    private readonly invoiceRepo: ISalesInvoiceRepository,
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly numberingEngine?: INumberingEngine
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<SalesInvoice[]> {
    const templates = await this.templateRepo.listDue(companyId, asOfDate);
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales settings not found');

    const created: SalesInvoice[] = [];

    for (const tmpl of templates) {
      const invoiceNumber = await generateUniqueDocumentNumber(
        settings,
        'SI',
        async (candidate) => typeof (this.invoiceRepo as any).getByNumber === 'function'
          ? !!(await (this.invoiceRepo as any).getByNumber(companyId, candidate))
          : false,
        this.numberingEngine,
        companyId,
      );

      const dueDate = this.computeDueDate(tmpl.nextGenerationDate, tmpl.paymentTermsDays);

      const si = new SalesInvoice({
        id: uuidv4(),
        companyId,
        invoiceNumber,
        formType: 'sales_invoice',
        voucherType: 'sales_invoice',
        persona: 'direct',
        customerId: tmpl.customerId,
        customerName: tmpl.customerName,
        invoiceDate: tmpl.nextGenerationDate,
        dueDate,
        currency: tmpl.currency,
        exchangeRate: tmpl.exchangeRate,
        lines: tmpl.lines.map((line, index) => ({
          lineId: uuidv4(),
          lineNo: index + 1,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          trackInventory: false,
          invoicedQty: line.qty,
          uom: 'Unit',
          unitPriceDoc: line.unitPriceDoc,
          lineTotalDoc: Math.round(line.qty * line.unitPriceDoc * 100) / 100,
          unitPriceBase: Math.round(line.unitPriceDoc * tmpl.exchangeRate * 100) / 100,
          lineTotalBase: Math.round(line.qty * line.unitPriceDoc * tmpl.exchangeRate * 100) / 100,
          taxCodeId: line.taxCodeId,
          taxCode: line.taxCode,
          taxRate: line.taxRate,
          taxAmountDoc: Math.round(line.qty * line.unitPriceDoc * line.taxRate * 100) / 100,
          taxAmountBase: Math.round(line.qty * line.unitPriceDoc * tmpl.exchangeRate * line.taxRate * 100) / 100,
          revenueAccountId: '',
          description: line.description,
        })),
        subtotalDoc: 0,
        taxTotalDoc: 0,
        grandTotalDoc: 0,
        subtotalBase: 0,
        taxTotalBase: 0,
        grandTotalBase: 0,
        paymentTermsDays: tmpl.paymentTermsDays,
        paymentStatus: 'UNPAID',
        paidAmountBase: 0,
        outstandingAmountBase: 0,
        status: 'DRAFT',
        notes: tmpl.notes ? `[Recurring] ${tmpl.notes}` : '[Recurring]',
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.invoiceRepo.create(si);
      created.push(si);

      const advanced = tmpl.advance(userId, new Date());
      await this.templateRepo.update(advanced);
    }

    if (created.length > 0) {
      await this.settingsRepo.saveSettings(settings);
    }

    return created;
  }

  private computeDueDate(invoiceDate: string, paymentTermsDays: number): string | undefined {
    if (!paymentTermsDays) return undefined;
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + paymentTermsDays);
    return d.toISOString().slice(0, 10);
  }
}

export class CloneInvoiceAsTemplateUseCase {
  constructor(
    private readonly templateRepo: IRecurringInvoiceTemplateRepository,
    private readonly invoiceRepo: ISalesInvoiceRepository
  ) {}

  async execute(
    companyId: string,
    userId: string,
    sourceInvoiceId: string,
    name: string,
    frequency: RecurrenceFrequency,
    dayOfMonth?: number,
    dayOfWeek?: number,
    startDate?: string,
    endDate?: string,
    maxOccurrences?: number
  ): Promise<RecurringInvoiceTemplate> {
    const source = await this.invoiceRepo.getById(companyId, sourceInvoiceId);
    if (!source) throw new Error('Source invoice not found');

    const today = new Date().toISOString().slice(0, 10);
    const nextDate = startDate || today;

    const template = new RecurringInvoiceTemplate({
      id: uuidv4(),
      companyId,
      name,
      sourceInvoiceId: sourceInvoiceId,
      customerId: source.customerId,
      customerName: source.customerName,
      currency: source.currency,
      exchangeRate: source.exchangeRate,
      lines: source.lines.map((line) => ({
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        qty: line.invoicedQty,
        unitPriceDoc: line.unitPriceDoc,
        taxCodeId: line.taxCodeId,
        taxCode: line.taxCode,
        taxRate: line.taxRate,
        description: line.description,
      })),
      notes: source.notes,
      paymentTermsDays: source.paymentTermsDays,
      frequency,
      dayOfMonth,
      dayOfWeek,
      startDate: nextDate,
      endDate,
      maxOccurrences,
      occurrencesGenerated: 0,
      nextGenerationDate: nextDate,
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: new Date(),
    });

    await this.templateRepo.create(template);
    return template;
  }
}
