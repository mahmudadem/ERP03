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

/**
 * FUP-5: a settlement/payment receipt the caller has already fully assembled (and posted to a
 * `VoucherEntity`), posted to the ledger via `PostingGateway` rather than the subledger assembler.
 * The caller passes the real posting action as `postFull`; the bridge decides full-vs-minimal and
 * only invokes `postFull` when the Accounting Engine is initialized. In minimal mode it records a
 * minimal-journal `PostingLog` and skips the GL voucher entirely.
 */
export interface PreBuiltVoucherEvent {
  companyId: string;
  kind: string;
  /** The assembled voucher — used for minimal-journal metadata and returned in full mode. */
  voucher: VoucherEntity;
  /** Performs the real full-mode posting (gateway.record + voucherRepo.save). Invoked only in full mode. */
  postFull: () => Promise<void>;
  transaction?: unknown;
}

export interface IAccountingBridge {
  recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord>;
  /** FUP-5: route a pre-assembled settlement/payment voucher through the full-vs-minimal decision. */
  recordPreBuiltVoucher(event: PreBuiltVoucherEvent): Promise<FinancialEventRecord>;
}
