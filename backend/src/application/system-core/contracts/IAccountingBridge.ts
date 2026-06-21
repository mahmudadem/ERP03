import {
  PostSubledgerVoucherInput,
} from '../../accounting/services/SubledgerVoucherPostingService';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';

export interface FinancialEvent {
  kind: string;
  subledgerVoucher?: PostSubledgerVoucherInput;
  payload?: Record<string, unknown>;
  transaction?: unknown;
}

export interface FinancialEventRecord {
  mode: 'full' | 'minimal';
  voucher: VoucherEntity | null;
  eventLogId?: string;
}

export interface IAccountingBridge {
  recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord>;
}
