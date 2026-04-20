import { useMemo } from 'react';

interface VoucherRow {
  debit?: number | string;
  credit?: number | string;
  equivalent?: number | string;
  amount?: number | string;
  side?: 'Debit' | 'Credit';
}

type VoucherTotalsMode = 'journal' | 'semantic';

export const useVoucherTotals = (
  rows: VoucherRow[], 
  headerRate: number = 1,
  convertFromBase: boolean = false,
  mode: VoucherTotalsMode = 'journal'
) => {
  const { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher } = useMemo(() => {
    if (mode === 'semantic') {
      const totalAmount = rows.reduce((sum, row) => {
        const val = (row as any)?.amount ?? (row as any)?.lineTotalDoc ?? (row as any)?.total ?? (row as any)?.lineTotal ?? (row as any)?.rowTotal ?? 0;
        return sum + (parseFloat(val as string) || 0);
      }, 0);
      return {
        totalDebitVoucher: totalAmount,
        totalCreditVoucher: totalAmount,
        isBalanced: totalAmount > 0,
        differenceVoucher: 0
      };
    }

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
    // We check both sides using Max Ratio to determine the mode for the WHOLE voucher (Unified Mode).
    const validatedHeaderRate = headerRate || 1;
    let finalDebitVoucher = debitEqSum;
    let finalCreditVoucher = creditEqSum;

    if (convertFromBase && validatedHeaderRate > 1.2) {
       // Heuristic: If Combined/Max Ratio is significant (close to HeaderRate), assume Base Equivalents for EVERYTHING.
       const debitRatio = debitAmountSum > 0 ? (debitEqSum / debitAmountSum) : 0;
       const creditRatio = creditAmountSum > 0 ? (creditEqSum / creditAmountSum) : 0;
       
       // Use max signal to detect Base Mode (if any side is clearly Base, the file is likely Base)
       const maxRatio = Math.max(debitRatio, creditRatio);
       
       if (maxRatio > (validatedHeaderRate * 0.3)) { // Threshold: 30% of Header Rate
          finalDebitVoucher = debitEqSum / validatedHeaderRate;
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
  }, [rows, headerRate, convertFromBase, mode]);

  return { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher };
};
