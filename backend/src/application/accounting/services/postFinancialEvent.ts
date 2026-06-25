import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { IAccountingBridge } from '../../system-core/contracts/IAccountingBridge';
import { PostSubledgerVoucherInput, SubledgerVoucherPostingService } from './SubledgerVoucherPostingService';

/**
 * FUP-3: single routing point for source-module GL postings.
 *
 * Sales / Purchases / Inventory use-cases post their financial events through this helper. When an
 * `IAccountingBridge` is wired (production), the event flows through the bridge — which applies the
 * full-vs-minimal decision (full GL only when the Accounting Engine is initialized; minimal journal
 * when the engine is not initialized, mirroring POS since 250k) — and returns the posted voucher or
 * `null` in minimal mode. When no bridge is wired
 * (e.g. existing unit tests that inject only the posting service), it falls back to the direct
 * posting service so legacy behavior is preserved.
 *
 * Callers MUST treat a `null` return as "no GL voucher was posted" (minimal mode) and avoid
 * dereferencing `voucher.id` — link the voucher id only when present.
 */
export interface FinancialEventPostingDeps {
  bridge?: IAccountingBridge;
  postingService?: SubledgerVoucherPostingService;
}

export interface FinancialEventPostingInput {
  kind: string;
  subledgerVoucher: PostSubledgerVoucherInput;
  transaction?: unknown;
}

export async function postFinancialEvent(
  deps: FinancialEventPostingDeps,
  input: FinancialEventPostingInput
): Promise<VoucherEntity | null> {
  if (deps.bridge) {
    const result = await deps.bridge.recordFinancialEvent({
      kind: input.kind,
      subledgerVoucher: input.subledgerVoucher,
      transaction: input.transaction,
    });
    return result.voucher;
  }
  if (deps.postingService) {
    return deps.postingService.postInTransaction(input.subledgerVoucher, input.transaction);
  }
  throw new Error('postFinancialEvent: no accounting bridge or posting service configured');
}
