import { PaymentHistory, PaymentSourceType } from '../../../domain/shared/entities/PaymentHistory';

export interface IPaymentHistoryRepository {
  create(payment: PaymentHistory, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PaymentHistory | null>;
  getBySource(companyId: string, sourceType: PaymentSourceType, sourceId: string): Promise<PaymentHistory[]>;
}
