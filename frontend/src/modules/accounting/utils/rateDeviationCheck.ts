import { accountingApi } from '../../../api/accountingApi';

export interface RateDeviationWarning {
  lineIndex: number;
  lineCurrency: string;
  effectiveRate: number;  // parity × headerRate (what voucher uses)
  systemRate: number;     // direct rate from system table
  deviation: number;      // percentage deviation
  amount: number;
  effectiveBaseAmount: number;
  systemBaseAmount: number;
}

export interface RateDeviationResult {
  hasDeviations: boolean;
  warnings: RateDeviationWarning[];
  totalEffectiveBase: { debit: number; credit: number };
  totalSystemBase: { debit: number; credit: number };
}

/**
 * Check for rate deviations before saving a voucher.
 * Compares the effective rate (parity × headerRate) with the system's direct rate.
 * 
 * Example: 
 * - Line: 500 USD in TRY voucher
 * - parity = 3 (USD→TRY), headerRate = 265 (TRY→SYP)
 * - Effective rate = 3 × 265 = 795 (USD→SYP via triangulation)
 * - System rate = 1000 (direct USD→SYP from rate table)
 * - Deviation = (795 - 1000) / 1000 = -20.5%
 */
export async function checkVoucherRateDeviations(
  lines: any[],
  voucherCurrency: string,
  headerRate: number,
  baseCurrency: string,
  voucherDate: string
): Promise<RateDeviationResult> {
  const warnings: RateDeviationWarning[] = [];
  let totalEffectiveDebit = 0;
  let totalEffectiveCredit = 0;
  let totalSystemDebit = 0;
  let totalSystemCredit = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.account && !line.accountId) continue;

    const lineCurrency = (line.currency || line.lineCurrency || voucherCurrency).toUpperCase();
    const parity = parseFloat(line.parity) || parseFloat(line.exchangeRate) || 1;
    const amount = Math.abs(parseFloat(line.debit) || parseFloat(line.credit) || parseFloat(line.amount) || 0);
    const side = line.side || (parseFloat(line.debit) > 0 ? 'Debit' : 'Credit');

    if (amount === 0) continue;

    // Calculate effective rate (what the voucher will use)
    const effectiveRate = parity * headerRate;
    const effectiveBaseAmount = amount * effectiveRate;

    // Accumulate totals
    if (side === 'Debit' || parseFloat(line.debit) > 0) {
      totalEffectiveDebit += effectiveBaseAmount;
    } else {
      totalEffectiveCredit += effectiveBaseAmount;
    }

    // Skip deviation check if line currency is voucher currency or base currency
    if (lineCurrency === voucherCurrency.toUpperCase() || lineCurrency === baseCurrency.toUpperCase()) {
      if (side === 'Debit' || parseFloat(line.debit) > 0) {
        totalSystemDebit += effectiveBaseAmount;
      } else {
        totalSystemCredit += effectiveBaseAmount;
      }
      continue;
    }

    // Fetch system rate for this line currency → base currency
    try {
      const result = await accountingApi.getSuggestedRate(lineCurrency, baseCurrency, voucherDate);
      
      if (result.rate) {
        const systemRate = result.rate;
        const systemBaseAmount = amount * systemRate;
        const deviation = ((effectiveRate - systemRate) / systemRate) * 100;

        // Accumulate system totals
        if (side === 'Debit' || parseFloat(line.debit) > 0) {
          totalSystemDebit += systemBaseAmount;
        } else {
          totalSystemCredit += systemBaseAmount;
        }

        // Only warn if deviation is significant (> 1%)
        if (Math.abs(deviation) > 1) {
          warnings.push({
            lineIndex: i + 1,
            lineCurrency,
            effectiveRate: Math.round(effectiveRate * 100) / 100,
            systemRate: Math.round(systemRate * 100) / 100,
            deviation: Math.round(deviation * 10) / 10,
            amount,
            effectiveBaseAmount: Math.round(effectiveBaseAmount * 100) / 100,
            systemBaseAmount: Math.round(systemBaseAmount * 100) / 100
          });
        }
      } else {
        // No system rate found, use effective for system totals
        if (side === 'Debit' || parseFloat(line.debit) > 0) {
          totalSystemDebit += effectiveBaseAmount;
        } else {
          totalSystemCredit += effectiveBaseAmount;
        }
      }
    } catch (error) {
      console.error(`[RATE CHECK] Failed to fetch rate for ${lineCurrency}→${baseCurrency}:`, error);
      // Use effective for system totals if fetch fails
      if (side === 'Debit' || parseFloat(line.debit) > 0) {
        totalSystemDebit += effectiveBaseAmount;
      } else {
        totalSystemCredit += effectiveBaseAmount;
      }
    }
  }

  return {
    hasDeviations: warnings.length > 0,
    warnings,
    totalEffectiveBase: { debit: totalEffectiveDebit, credit: totalEffectiveCredit },
    totalSystemBase: { debit: totalSystemDebit, credit: totalSystemCredit }
  };
}
