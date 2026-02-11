import { RecurringVoucherTemplate } from '../../../domain/accounting/entities/RecurringVoucherTemplate';

export interface IRecurringVoucherTemplateRepository {
  create(template: RecurringVoucherTemplate): Promise<RecurringVoucherTemplate>;
  update(template: RecurringVoucherTemplate): Promise<RecurringVoucherTemplate>;
  list(companyId: string): Promise<RecurringVoucherTemplate[]>;
  findById(companyId: string, id: string): Promise<RecurringVoucherTemplate | null>;
  listDue(companyId: string, asOfDate: string): Promise<RecurringVoucherTemplate[]>;
}
