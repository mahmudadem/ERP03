/**
 * GetAiCreditBalanceUseCase
 *
 * Returns the current AI credit balance for a tenant.
 * If no ledger exists yet, returns a zero-balance response
 * rather than throwing an error — the tenant simply hasn't been
 * granted any credits.
 *
 * Dependencies: IAiCreditLedgerRepository (DB-agnostic)
 */

import { IAiCreditLedgerRepository } from '../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';

export interface GetAiCreditBalanceInput {
  companyId: string;
}

export interface GetAiCreditBalanceOutput {
  companyId: string;
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  lastDebitAt: string | null;
  lastCreditAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export class GetAiCreditBalanceUseCase {
  constructor(private creditLedgerRepository: IAiCreditLedgerRepository) {}

  async execute(input: GetAiCreditBalanceInput): Promise<GetAiCreditBalanceOutput> {
    const ledger = await this.creditLedgerRepository.getByCompanyId(input.companyId);

    // No ledger yet → return zero-balance response instead of failing
    if (!ledger) {
      return {
        companyId: input.companyId,
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        lastDebitAt: null,
        lastCreditAt: null,
        createdAt: null,
        updatedAt: null,
      };
    }

    const json = ledger.toJSON();
    return {
      companyId: json.companyId as string,
      balance: json.balance as number,
      totalPurchased: json.totalPurchased as number,
      totalConsumed: json.totalConsumed as number,
      lastDebitAt: json.lastDebitAt as string | null,
      lastCreditAt: json.lastCreditAt as string | null,
      createdAt: json.createdAt as string,
      updatedAt: json.updatedAt as string,
    };
  }
}