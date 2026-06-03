import { GuardName, PostingError } from './AppError';
import { CreditLimitExceededError } from '../../sales/errors/CreditLimitExceededError';
import { AppError as InfraAppError } from '../../../errors/AppError';

/**
 * Stage 5 — "Every guard signs its refusal."
 *
 * A single, uniform shape for every guard rejection, so an API consumer can always see WHICH guard
 * refused and WHY, regardless of which error subclass was thrown. See Law 5 in
 * docs/architecture/posting-authority.md.
 */
export interface RejectionContract {
  /** The guard that refused. */
  guard: GuardName;
  /** Machine-readable code (e.g. PERIOD_LOCKED, APPROVAL_REQUIRED, CREDIT_LIMIT_EXCEEDED). */
  code: string;
  /** Human-readable message. */
  message: string;
  /** Fields the user should look at (e.g. ['date'], ['creditLimit']). Always an array. */
  fieldHints: string[];
  /** The policy that produced this rejection, when applicable (e.g. 'period-lock'). */
  policyId?: string;
  /** Request correlation id for tracing, when available. */
  correlationId?: string;
}

/** Best-effort guard inference for an AppError code (used when no explicit guard is attached). */
function inferGuardFromCode(code: string): GuardName {
  const c = (code || '').toUpperCase();
  if (c.startsWith('ACC') || c.startsWith('VOUCH') || c.startsWith('LEDGER') || c.startsWith('FISCAL')) {
    return 'accounting';
  }
  if (c.startsWith('CREDIT') || c.startsWith('SALES')) return 'sales';
  if (c.startsWith('PURCH')) return 'purchases';
  if (c.startsWith('STOCK') || c.startsWith('INV')) return 'inventory';
  return 'system';
}

/**
 * Map any known guard error onto the uniform rejection contract. Returns `null` for errors that are
 * not guard rejections (infrastructure failures, unknown errors) so the caller can fall through to
 * its generic handling.
 */
export function toRejectionContract(err: unknown): RejectionContract | null {
  // PostingError family (includes PeriodLockedError, PersonaNotAllowedError, and policy violations).
  if (err instanceof PostingError) {
    const app = err.appError;
    const firstViolation = app.details?.violations?.[0];
    return {
      guard: app.guard ?? inferGuardFromCode(app.code),
      code: app.code,
      message: app.message,
      fieldHints: firstViolation?.fieldHints ?? [],
      policyId: firstViolation?.policyId,
      correlationId: app.correlationId,
    };
  }

  // Credit limit — a Sales-owned guard rejection (Law 2: credit limit belongs to Sales).
  if (err instanceof CreditLimitExceededError) {
    return {
      guard: 'sales',
      code: err.code,
      message: err.message,
      fieldHints: ['creditLimit'],
      policyId: 'credit-limit',
    };
  }

  // BusinessError / ValidationError / generic AppError (errors/AppError) carry an ErrorCode.
  if (err instanceof InfraAppError) {
    return {
      guard: inferGuardFromCode(String(err.code)),
      code: String(err.code),
      message: err.message,
      fieldHints: err.field ? [err.field] : [],
    };
  }

  return null;
}
