import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface PersonaNotAllowedErrorDetails {
  companyId: string;
  module: 'sales' | 'purchases';
  persona: string;
  formType?: string;
  /** Optional human-readable reason from governance rules. */
  reason?: string;
}

/**
 * Thrown when a Sales/Purchases document is created with a persona that is
 * disabled by the company / form / branch governance policy. Replaces the
 * previous silent-allow path on the Sales side; matches the existing hard-throw
 * behaviour on Purchases.
 */
export class PersonaNotAllowedError extends PostingError {
  constructor(details: PersonaNotAllowedErrorDetails) {
    const formHint = details.formType ? ` (form ${details.formType})` : '';
    const reasonHint = details.reason ? ` — ${details.reason}` : '';
    const message =
      `${details.module === 'sales' ? 'Sales Invoice' : 'Purchase Invoice'} persona '${details.persona}'${formHint} is not allowed by company governance policy${reasonHint}.`;
    const violations: ErrorViolation[] = [
      {
        code: 'PERSONA_NOT_ALLOWED',
        message,
        fieldHints: [
          `persona=${details.persona}`,
          ...(details.formType ? [`formType=${details.formType}`] : []),
        ],
        policyId: 'document-persona-governance',
      },
    ];
    super({
      code: 'PERSONA_NOT_ALLOWED',
      message,
      category: ErrorCategory.POLICY,
      // Persona governance is owned by the originating module's guard, not accounting.
      guard: details.module,
      details: { violations },
    });
    this.name = 'PersonaNotAllowedError';
  }
}
