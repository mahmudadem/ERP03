import { VoucherLine } from '../../entities/VoucherLine';

export interface IVoucherPostingStrategy {
  generateLines(header: any, companyId: string): Promise<VoucherLine[]>;
}
