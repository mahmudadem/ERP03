import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { IAccountingBridge, FinancialEvent } from '../contracts/IAccountingBridge';

export class LegacyAccountingBridgeAdapter implements IAccountingBridge {
  constructor(private readonly subledgerPostingService: SubledgerVoucherPostingService) {}

  async recordFinancialEvent(event: FinancialEvent) {
    if (!event.subledgerVoucher) return null;
    return this.subledgerPostingService.postInTransaction(event.subledgerVoucher, event.transaction);
  }
}

