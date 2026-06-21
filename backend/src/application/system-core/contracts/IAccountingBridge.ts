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

export interface IAccountingBridge {
  recordFinancialEvent(event: FinancialEvent): Promise<VoucherEntity | null>;
}

