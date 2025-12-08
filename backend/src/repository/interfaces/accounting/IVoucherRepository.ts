
import { Voucher } from '../../../domain/accounting/entities/Voucher';

/**
 * Interface for Voucher/Transaction access.
 */
export interface IVoucherRepository {
  createVoucher(voucher: Voucher, transaction?: any): Promise<void>;
  updateVoucher(id: string, data: Partial<Voucher>, transaction?: any): Promise<void>;
  deleteVoucher(id: string, transaction?: any): Promise<void>;
  getVoucher(id: string): Promise<Voucher | null>;
  getVouchers(companyId: string, filters?: any): Promise<Voucher[]>;
}
