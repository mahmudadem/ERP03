/**
 * IAiCreditLedgerRepository - Repository Interface
 *
 * DB-agnostic interface for AI credit ledger persistence.
 * Each company has exactly one ledger document.
 */

import { AiCreditLedger } from '../../../domain/ai-assistant/entities/AiCreditLedger';

export interface IAiCreditLedgerRepository {
  /**
   * Get the credit ledger for a company.
   * Returns null if no ledger exists yet.
   */
  getByCompanyId(companyId: string): Promise<AiCreditLedger | null>;

  /**
   * Save (create or update) the credit ledger for a company.
   */
  save(ledger: AiCreditLedger): Promise<AiCreditLedger>;
}