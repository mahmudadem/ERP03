import { useMemo } from 'react';

interface VoucherRow {
  debit?: number | string;
  credit?: number | string;
  equivalent?: number | string;
  amount?: number | string;
  side?: 'Debit' | 'Credit';
}

export const useVoucherTotals = (
  rows: VoucherRow[], 
  headerRate: number = 1,
  convertFromBase: boolean = false
) => {
  const { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher } = useMemo(() => {
    let debitEqSum = 0;
    let creditEqSum = 0;
    let debitAmountSum = 0;
    let creditAmountSum = 0;

    rows.forEach(row => {
      // Use equivalent (Base Currency Amount for Posted, or Voucher Currency Amount for Draft)
      const eq = parseFloat(row.equivalent as string) || 0;
      const debit = parseFloat(row.debit as string) || 0;
      const credit = parseFloat(row.credit as string) || 0;

      if (debit > 0) {
        debitEqSum += eq || debit; 
        debitAmountSum += debit;
      } else if (credit > 0) {
        creditEqSum += eq || credit;
        creditAmountSum += credit;
      }
    });

    // Valid balance check is done on the summed values
    const isBalanced = Math.abs(debitEqSum - creditEqSum) < 0.05;

    // Calculate totals in VOUCHER CURRENCY
    // Adaptive Logic: Check if equivalents seem to be in Base Currency (Huge) or Voucher Currency (Normal)
    // This handles inconsistent backend states where some posted vouchers return Base Eq and others return Voucher Eq.
    const validatedHeaderRate = headerRate || 1;
    let finalDebitVoucher = debitEqSum;
    let finalCreditVoucher = creditEqSum;

    if (convertFromBase && validatedHeaderRate > 1.2) {
       // Heuristic: If Equivalent/Amount ratio is significant (close to HeaderRate), assume Base Equivalents and divide.
       // If ratio is small (close to 1), assume Voucher Equivalents and keep as is.
       const debitRatio = debitAmountSum > 0 ? (debitEqSum / debitAmountSum) : 0;
       if (debitRatio > (validatedHeaderRate * 0.3)) { // Threshold: 30% of Header Rate
          finalDebitVoucher = debitEqSum / validatedHeaderRate;
       }

       const creditRatio = creditAmountSum > 0 ? (creditEqSum / creditAmountSum) : 0;
       if (creditRatio > (validatedHeaderRate * 0.3)) {
          finalCreditVoucher = creditEqSum / validatedHeaderRate;
       }
    }

    const differenceVoucher = Math.abs(finalDebitVoucher - finalCreditVoucher);

    return {
      totalDebitVoucher: finalDebitVoucher,
      totalCreditVoucher: finalCreditVoucher,
      isBalanced,
      differenceVoucher
    };
  }, [rows, headerRate, convertFromBase]);

  return { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher };
};
