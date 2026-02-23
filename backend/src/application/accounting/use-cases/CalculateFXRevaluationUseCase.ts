import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export interface FXRevaluationCalculationInput {
  companyId: string;
  asOfDate: Date;
  targetAccountIds?: string[]; // Optional: if empty, revalues ALL foreign currency accounts
  exchangeRates: Record<string, number>; // Maps currencyCode to new target rate (e.g. { 'USD': 1.5 })
}

export interface FXRevaluationResultLine {
  accountId: string;
  accountName: string;
  accountSystemCode: string;
  currency: string;
  foreignBalance: number;
  historicalBaseBalance: number;
  newRate: number;
  targetBaseBalance: number;
  deltaBase: number; // Positive = Gain, Negative = Loss
}

export interface FXRevaluationResult {
  asOfDate: Date;
  lines: FXRevaluationResultLine[];
  totalGain: number;
  totalLoss: number;
  netDelta: number;
}

export class CalculateFXRevaluationUseCase {
  constructor(
    private readonly ledgerRepo: ILedgerRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyRepo: ICompanyRepository
  ) {}
  
  /**
   * Calculates the unrealized gains/losses for foreign currency accounts.
   * Does NOT save anything to the database.
   */
  async execute(input: FXRevaluationCalculationInput): Promise<FXRevaluationResult> {
    const { companyId, asOfDate, targetAccountIds, exchangeRates } = input;

    // 1. Get company base currency
    const company = await this.companyRepo.findById(companyId);

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const { baseCurrency } = company;

    // 2. Fetch current foreign balances from Ledger
    const foreignBalances = await this.ledgerRepo.getForeignBalances(companyId, asOfDate, targetAccountIds);

    // 3. Fetch Account details for these balances to enrich the result
    const resultLines: FXRevaluationResultLine[] = [];
    let totalGain = 0;
    let totalLoss = 0;

    for (const bal of foreignBalances) {
      // Skip if foreign balance is exactly 0
      if (roundMoney(bal.foreignBalance) === 0) {
        continue;
      }

      const account = await this.accountRepo.getById(companyId, bal.accountId);
      if (!account) continue;

      const newRate = exchangeRates[bal.currency];
      
      if (newRate === undefined || newRate <= 0) {
        throw new Error(`Missing or invalid exchange rate for currency: ${bal.currency}`);
      }

      // Calculate what the base balance SHOULD be at the new rate
      const targetBaseBalanceRaw = bal.foreignBalance * newRate;
      const targetBaseBalance = roundMoney(targetBaseBalanceRaw);
      
      const historicalBaseBalance = roundMoney(bal.baseBalance);

      // Delta = Target - Historical
      // Positive: Debit adjustment (Gain for Asset, Loss for Liability)
      const deltaBase = roundMoney(targetBaseBalance - historicalBaseBalance);

      if (deltaBase > 0) {
        totalGain += deltaBase;
      } else if (deltaBase < 0) {
        totalLoss += Math.abs(deltaBase);
      }

      resultLines.push({
        accountId: bal.accountId,
        accountName: account.name,
        accountSystemCode: account.systemCode,
        currency: bal.currency,
        foreignBalance: roundMoney(bal.foreignBalance),
        historicalBaseBalance,
        newRate,
        targetBaseBalance,
        deltaBase
      });
    }

    return {
      asOfDate,
      lines: resultLines,
      totalGain: roundMoney(totalGain),
      totalLoss: roundMoney(totalLoss),
      netDelta: roundMoney(totalGain - totalLoss)
    };
  }
}
