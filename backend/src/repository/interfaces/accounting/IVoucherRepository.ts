
import { Voucher } from '../../../domain/accounting/entities/Voucher';

/**
 * Interface for Voucher/Transaction access.
 */
export interface IVoucherRepository {
  createVoucher(voucher: Voucher): Promise<void>;
  updateVoucher(id: string, data: Partial<Voucher>): Promise<void>;
  deleteVoucher(id: string): Promise<void>;
  getVoucher(id: string): Promise<Voucher | null>;
  getVouchers(companyId: string, filters?: any): Promise<Voucher[]>;
}
