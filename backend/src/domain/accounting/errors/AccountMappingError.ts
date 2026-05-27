import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export type AccountRole =
  | 'revenue'
  | 'cogs'
  | 'inventory'
  | 'tax'
  | 'ar'
  | 'ap'
  | 'discount'
  | 'grni'
  | 'expense'
  | 'fxGain'
  | 'fxLoss';

export interface AccountMappingErrorDetails {
  companyId: string;
  /** Item being posted, if applicable. */
  itemId?: string;
  /** Which account role failed to resolve. */
  accountRole: AccountRole;
  /** Ordered list of configuration levels that were tried. */
  fallbackChain: string[];
  /** Optional line number for invoice/DN context. */
  lineNo?: number;
  /** Optional context note. */
  hint?: string;
}

/**
 * Thrown when a required GL account cannot be resolved through the configured
 * fallback chain. Replaces the previous silent-skip behaviour for revenue, tax,
 * COGS, inventory, and discount accounts.
 *
 * Missing-account is NEVER a valid deferred-cost reason — see posting-log.md
 * for the distinction between this error and `SKIPPED_UNSETTLED_COST`.
 */
export class AccountMappingError extends PostingError {
  constructor(details: AccountMappingErrorDetails) {
    const lineHint = details.lineNo !== undefined ? ` (line ${details.lineNo})` : '';
    const itemHint = details.itemId ? ` for item ${details.itemId}` : '';
    const chainHint = details.fallbackChain.length
      ? ` Resolution tried: ${details.fallbackChain.join(' → ')}.`
      : '';
    const advice = details.hint ? ` ${details.hint}` : '';
    const message =
      `No ${details.accountRole} account configured${itemHint}${lineHint}.${chainHint}${advice}`;
    const violations: ErrorViolation[] = [
      {
        code: `ACCOUNT_MAPPING_MISSING_${details.accountRole.toUpperCase()}`,
        message,
        fieldHints: [
          ...(details.itemId ? [`itemId=${details.itemId}`] : []),
          ...(details.lineNo !== undefined ? [`lineNo=${details.lineNo}`] : []),
        ],
        policyId: 'account-mapping-required',
      },
    ];
    super({
      code: 'ACCOUNT_MAPPING_MISSING',
      message,
      category: ErrorCategory.VALIDATION,
      details: { violations },
    });
    this.name = 'AccountMappingError';
  }
}
