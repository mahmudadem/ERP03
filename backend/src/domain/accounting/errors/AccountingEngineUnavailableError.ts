import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface AccountingEngineUnavailableDetails {
  companyId: string;
  reason: 'MISSING_BASE_CURRENCY' | 'MISSING_COA_TEMPLATE' | 'INIT_FAILED' | 'NOT_INITIALIZED';
  missingFields?: string[];
  cause?: string;
}

export class AccountingEngineUnavailableError extends PostingError {
  constructor(details: AccountingEngineUnavailableDetails) {
    const message = formatMessage(details);
    const violations: ErrorViolation[] = [
      {
        code: `ACCOUNTING_ENGINE_${details.reason}`,
        message,
        fieldHints: details.missingFields,
        policyId: 'accounting-engine-required',
      },
    ];
    super({
      code: 'ACCOUNTING_ENGINE_UNAVAILABLE',
      message,
      category: ErrorCategory.CORE_INVARIANT,
      details: { violations },
    });
    this.name = 'AccountingEngineUnavailableError';
  }
}

function formatMessage(d: AccountingEngineUnavailableDetails): string {
  switch (d.reason) {
    case 'MISSING_BASE_CURRENCY':
      return `Accounting Engine cannot be initialized for company ${d.companyId}: base currency is not set on the company.`;
    case 'MISSING_COA_TEMPLATE':
      return `Accounting Engine cannot be initialized for company ${d.companyId}: no default chart-of-accounts template found.`;
    case 'INIT_FAILED':
      return `Accounting Engine initialization failed for company ${d.companyId}${d.cause ? `: ${d.cause}` : '.'}`;
    case 'NOT_INITIALIZED':
      return `Accounting Engine is not initialized for company ${d.companyId} and auto-initialization is disabled in this context.`;
  }
}
