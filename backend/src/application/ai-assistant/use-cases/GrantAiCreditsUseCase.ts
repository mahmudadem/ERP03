/**
 * GrantAiCreditsUseCase
 *
 * Super Admin grants credits to a tenant.
 * - If the ledger already exists, credits are added via ledger.credit().
 * - If no ledger exists, a new one is created via AiCreditLedger.create().
 *
 * Dependencies: IAiCreditLedgerRepository (DB-agnostic)
 */

import { IAiCreditLedgerRepository } from '../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';
import { AiCreditLedger } from '../../../domain/ai-assistant/entities/AiCreditLedger';
import { ApiError } from '../../../api/errors/ApiError';

export interface GrantAiCreditsInput {
  companyId: string;
  amount: number;
  reason?: string;
}

export interface GrantAiCreditsOutput {
  companyId: string;
  newBalance: number;
  grantedAmount: number;
  grantedAt: string;
}

export class GrantAiCreditsUseCase {
  constructor(private creditLedgerRepository: IAiCreditLedgerRepository) {}

  async execute(input: GrantAiCreditsInput): Promise<GrantAiCreditsOutput> {
    // Validate companyId
    if (!input.companyId || typeof input.companyId !== 'string' || input.companyId.trim().length === 0) {
      throw ApiError.badRequest('companyId is required and must be a non-empty string');
    }

    // Validate amount is a positive finite number
    if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw ApiError.badRequest('amount must be a positive finite number');
    }

    const reason = input.reason || 'Credit grant by Super Admin';
    const grantedAt = new Date();

    let ledger = await this.creditLedgerRepository.getByCompanyId(input.companyId);

    if (ledger) {
      // Existing ledger — add credits
      ledger.credit(input.amount, reason);
    } else {
      // No ledger yet — create one with initial credits
      ledger = AiCreditLedger.create(input.companyId, input.amount);
    }

    const saved = await this.creditLedgerRepository.save(ledger);

    return {
      companyId: saved.companyId,
      newBalance: saved.balance,
      grantedAmount: input.amount,
      grantedAt: grantedAt.toISOString(),
    };
  }
}