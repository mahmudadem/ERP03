
import { Voucher } from '../../../domain/accounting/entities/Voucher';

/**
 * Interface for Voucher/Transaction access.
 * All methods require companyId for company-scoped data isolation.
 */
export interface IVoucherRepository {
  createVoucher(voucher: Voucher, transaction?: any): Promise<void>;
  updateVoucher(companyId: string, id: string, data: Partial<Voucher>, transaction?: any): Promise<void>;
  deleteVoucher(companyId: string, id: string, transaction?: any): Promise<void>;
  getVoucher(companyId: string, id: string): Promise<Voucher | null>;
  getVouchers(companyId: string, filters?: any): Promise<Voucher[]>;
  getVouchersByDateRange(companyId: string, fromDate: Date, toDate: Date): Promise<Voucher[]>;
}
