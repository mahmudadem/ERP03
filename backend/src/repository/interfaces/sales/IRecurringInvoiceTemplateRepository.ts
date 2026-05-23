import { RecurringInvoiceTemplate } from '../../../domain/sales/entities/RecurringInvoiceTemplate';

export interface RecurringInvoiceTemplateListOptions {
  status?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}

export interface IRecurringInvoiceTemplateRepository {
  create(template: RecurringInvoiceTemplate, transaction?: unknown): Promise<void>;
  update(template: RecurringInvoiceTemplate, transaction?: unknown): Promise<void>;
  findById(companyId: string, id: string): Promise<RecurringInvoiceTemplate | null>;
  list(companyId: string, opts?: RecurringInvoiceTemplateListOptions): Promise<RecurringInvoiceTemplate[]>;
  listDue(companyId: string, asOfDate: string): Promise<RecurringInvoiceTemplate[]>;
  delete(companyId: string, id: string): Promise<void>;
}
