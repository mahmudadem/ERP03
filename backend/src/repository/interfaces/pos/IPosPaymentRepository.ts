import { PosPayment } from '../../../domain/pos/entities/PosPayment';

export interface IPosPaymentRepository {
  create(payment: PosPayment, tx?: unknown): Promise<void>;
  listByReceipt(companyId: string, receiptId: string): Promise<PosPayment[]>;
}
