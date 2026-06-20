import { PosReceipt, PosReceiptStatus } from '../../../domain/pos/entities/PosReceipt';

export interface IPosReceiptRepository {
  create(receipt: PosReceipt, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosReceipt | null>;
  getByNumber(companyId: string, number: string): Promise<PosReceipt | null>;
  list(
    companyId: string,
    filters?: { shiftId?: string; registerId?: string; customerId?: string; dateFrom?: string; dateTo?: string; limit?: number }
  ): Promise<PosReceipt[]>;
}
