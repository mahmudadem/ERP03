import { VoucherLineEntity } from '../entities/VoucherLineEntity';

export interface IVoucherPostingStrategy {
  generateLines(header: any, companyId: string): Promise<VoucherLineEntity[]>;
}
