import { v4 as uuidv4 } from 'uuid';
import { RecurringVoucherTemplate, RecurrenceFrequency } from '../../../domain/accounting/entities/RecurringVoucherTemplate';
import { IRecurringVoucherTemplateRepository } from '../../../repository/interfaces/accounting/IRecurringVoucherTemplateRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';

export interface CreateRecurringTemplateInput {
  name: string;
  sourceVoucherId: string;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
}

export class CreateRecurringTemplateUseCase {
  constructor(
    private readonly templateRepo: IRecurringVoucherTemplateRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, input: CreateRecurringTemplateInput): Promise<RecurringVoucherTemplate> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    const source = await this.voucherRepo.findById(companyId, input.sourceVoucherId);
    if (!source) throw new Error('Source voucher not found');

    const nextDate = input.startDate;
    const template = new RecurringVoucherTemplate(
      uuidv4(),
      companyId,
      input.name,
      input.sourceVoucherId,
      input.frequency,
      input.dayOfMonth,
      input.startDate,
      input.endDate,
      input.maxOccurrences,
      0,
      nextDate,
      'ACTIVE',
      userId,
      new Date()
    );
    return this.templateRepo.create(template);
  }
}

export class UpdateRecurringTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringVoucherTemplateRepository, private readonly permissionChecker: PermissionChecker) {}

  async execute(companyId: string, userId: string, id: string, partial: Partial<CreateRecurringTemplateInput>): Promise<RecurringVoucherTemplate> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    const existing = await this.templateRepo.findById(companyId, id);
    if (!existing) throw new Error('Template not found');
    const updated = new RecurringVoucherTemplate(
      existing.id,
      existing.companyId,
      partial.name || existing.name,
      partial.sourceVoucherId || existing.sourceVoucherId,
      (partial.frequency as RecurrenceFrequency) || existing.frequency,
      partial.dayOfMonth || existing.dayOfMonth,
      partial.startDate || existing.startDate,
      partial.endDate !== undefined ? partial.endDate : existing.endDate,
      partial.maxOccurrences !== undefined ? partial.maxOccurrences : existing.maxOccurrences,
      existing.occurrencesGenerated,
      partial.startDate ? partial.startDate : existing.nextGenerationDate,
      existing.status,
      existing.createdBy,
      existing.createdAt,
      new Date(),
      userId
    );
    return this.templateRepo.update(updated);
  }
}

export class PauseRecurringTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringVoucherTemplateRepository, private readonly permissionChecker: PermissionChecker) {}
  async execute(companyId: string, userId: string, id: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    const tmpl = await this.templateRepo.findById(companyId, id);
    if (!tmpl) throw new Error('Template not found');
    const paused = tmpl.pause(userId, new Date());
    return this.templateRepo.update(paused);
  }
}

export class ResumeRecurringTemplateUseCase {
  constructor(private readonly templateRepo: IRecurringVoucherTemplateRepository, private readonly permissionChecker: PermissionChecker) {}
  async execute(companyId: string, userId: string, id: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    const tmpl = await this.templateRepo.findById(companyId, id);
    if (!tmpl) throw new Error('Template not found');
    const resumed = tmpl.resume(userId, new Date());
    return this.templateRepo.update(resumed);
  }
}

export class GenerateRecurringVouchersUseCase {
  constructor(
    private readonly templateRepo: IRecurringVoucherTemplateRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<VoucherEntity[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    const templates = await this.templateRepo.listDue(companyId, asOfDate);
    const created: VoucherEntity[] = [];

    for (const tmpl of templates) {
      const src = await this.voucherRepo.findById(companyId, tmpl.sourceVoucherId);
      if (!src) continue;

      // clone voucher as draft with new date
      const newDate = tmpl.nextGenerationDate;
      const copy = new VoucherEntity(
        uuidv4(),
        companyId,
        '', // voucher number will be generated by create flow; leave empty
        src.type,
        newDate,
        `[Recurring] ${src.description || ''}`,
        src.currency,
        src.baseCurrency,
        src.exchangeRate,
        src.lines,
        src.totalDebit,
        src.totalCredit,
        src.status, // will stay same; downstream flow can re-approve/post
        { ...src.metadata, recurringTemplateId: tmpl.id },
        userId,
        new Date()
      );
      await this.voucherRepo.save(copy);
      created.push(copy);

      // advance template
      const nextDate = this.computeNextDate(tmpl.frequency, tmpl.dayOfMonth, tmpl.nextGenerationDate);
      const occurrences = tmpl.occurrencesGenerated + 1;
      const completed =
        (tmpl.maxOccurrences && occurrences >= tmpl.maxOccurrences) ||
        (tmpl.endDate && nextDate > tmpl.endDate);
      const updated = new RecurringVoucherTemplate(
        tmpl.id,
        tmpl.companyId,
        tmpl.name,
        tmpl.sourceVoucherId,
        tmpl.frequency,
        tmpl.dayOfMonth,
        tmpl.startDate,
        tmpl.endDate,
        tmpl.maxOccurrences,
        occurrences,
        completed ? tmpl.nextGenerationDate : nextDate,
        completed ? 'COMPLETED' : tmpl.status,
        tmpl.createdBy,
        tmpl.createdAt,
        new Date(),
        userId
      );
      await this.templateRepo.update(updated);
    }

    return created;
  }

  private computeNextDate(freq: RecurrenceFrequency, day: number, currentDate: string): string {
    const d = new Date(currentDate);
    const addMonths = freq === 'MONTHLY' ? 1 : freq === 'QUARTERLY' ? 3 : 12;
    d.setMonth(d.getMonth() + addMonths);
    // set to desired day, clamp to month length
    const target = new Date(d.getFullYear(), d.getMonth(), Math.min(day, 28));
    return target.toISOString().slice(0, 10);
  }
}
