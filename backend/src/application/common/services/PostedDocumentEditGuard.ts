import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

/**
 * Phase 0 of the edit-policy work (Task 179 — "Editing posted documents").
 *
 * Until the full layered edit-policy resolver (Mode A "amend" / Mode B "reverse
 * & re-issue") and the reverse/repost machinery land, a POSTED sales/purchase
 * document may have its NON-financial fields edited in place (notes,
 * salesperson, customer/vendor reference, due date) but NOT its financial
 * fields (party, date, currency, FX, lines, charges).
 *
 * Why financial edits are refused here: the posted document is mirrored by a
 * ledger voucher. Rewriting amounts in place would desync the document from the
 * books — the exact invariant the Posting-Authority epic exists to protect.
 * Financial corrections must go through reversal or an approved amendment, both
 * of which re-run the posting gateway. That path is built in later phases of
 * Task 179.
 *
 * Status handling (the caller still owns the status switch; this only decides
 * the POSTED branch):
 *   - DRAFT            → fully editable (caller proceeds normally)
 *   - POSTED           → only non-financial fields; this guard throws if any
 *                        financial field actually changed
 *   - PENDING_APPROVAL → caller keeps its existing handling (recall-to-draft)
 *   - CANCELLED/REVERSED → caller keeps its existing hard block
 */
export function assertPostedNonFinancialEditOnly(params: {
  status: string;
  entityLabel: string;
  changedFinancialFields: string[];
}): void {
  const { status, entityLabel, changedFinancialFields } = params;
  if (changedFinancialFields.length === 0) return;
  throw new BusinessError(
    ErrorCode.POSTED_FINANCIAL_EDIT_BLOCKED,
    `Cannot change financial fields on a ${status.toLowerCase()} ${entityLabel}: ` +
      `${changedFinancialFields.join(', ')}. Reverse the document or submit an ` +
      `approved amendment instead — posted amounts cannot be rewritten in place.`,
    { status, changedFinancialFields }
  );
}

/** True when an optional incoming value is provided and differs from current. */
export function scalarChanged<T>(incoming: T | undefined, current: T): boolean {
  return incoming !== undefined && incoming !== current;
}

/**
 * Compare two sets of line "financial signatures" for equality, order-
 * independent. A signature captures only the fields that move the ledger
 * (item, qty, price, tax code, discount, inclusive flag). Returns true when the
 * incoming lines are financially identical to the current lines.
 *
 * `incoming` signatures must already be built with effective values (incoming
 * field ?? existing field) so that a payload which omits an unchanged field is
 * not mistaken for a change.
 */
export function lineSignaturesEqual(currentSigs: string[], incomingSigs: string[]): boolean {
  if (currentSigs.length !== incomingSigs.length) return false;
  const a = [...currentSigs].sort();
  const b = [...incomingSigs].sort();
  return a.every((sig, i) => sig === b[i]);
}
