import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity } from '../../entities/VoucherLineEntity';
import { generateSubledgerDocumentLines } from './SubledgerDocumentStrategyHelper';

export class PurchaseReturnStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    return generateSubledgerDocumentLines(header, baseCurrency);
  }
}

