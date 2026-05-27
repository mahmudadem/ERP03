import { Quote } from '../../../domain/sales/entities/Quote';

export interface QuoteListOptions {
  status?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}

export interface IQuoteRepository {
  create(quote: Quote, transaction?: unknown): Promise<void>;
  update(quote: Quote, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<Quote | null>;
  getByNumber(companyId: string, quoteNumber: string): Promise<Quote | null>;
  list(companyId: string, opts?: QuoteListOptions): Promise<Quote[]>;
  delete(companyId: string, id: string): Promise<void>;
}
