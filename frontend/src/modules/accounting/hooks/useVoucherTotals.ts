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
  headerRate: number = 1 // Rate of Voucher Currency against Base Currency
) => {
  const { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher } = useMemo(() => {
    let debitEqSum = 0;
    let creditEqSum = 0;

    rows.forEach(row => {
      // Use equivalent (Base Currency Amount)
      // GenericVoucherRenderer usually provides 'equivalent' calculated from input
      // If missing, fallback to raw debit/credit (assuming base currency row)
      const eq = parseFloat(row.equivalent as string) || 0;
      const debit = parseFloat(row.debit as string) || 0;
      const credit = parseFloat(row.credit as string) || 0;

      // Determine side to add equivalent to
      // Some rows might have only 'amount' and 'side' (legacy), but renderer usually normalizes to debit/credit columns
      if (debit > 0) {
        debitEqSum += eq || debit; // Fallback to raw if logic is weird, but usually eq is safer
      } else if (credit > 0) {
        creditEqSum += eq || credit;
      }
    });

    // Valid balance check is done on the summed values (Voucher Currency)
    // If voucher is balanced in voucher currency, it implies balance in base (assuming consistent rates)
    const isBalanced = Math.abs(debitEqSum - creditEqSum) < 0.05;

    // Calculate totals in VOUCHER CURRENCY
    // The 'equivalent' column from renderer (calculated as Amount * Parity) 
    // represents the value in the Voucher's Currency.
    // So we just sum them up. No extra division needed.
    const totalDebitVoucher = debitEqSum;
    const totalCreditVoucher = creditEqSum;

    const differenceVoucher = Math.abs(totalDebitVoucher - totalCreditVoucher);

    return {
      totalDebitVoucher,
      totalCreditVoucher,
      isBalanced,
      differenceVoucher
    };
  }, [rows, headerRate]);

  return { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher };
};
