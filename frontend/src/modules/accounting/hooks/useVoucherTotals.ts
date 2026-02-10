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

    rows.forEach(row => {
      // Use equivalent (Base Currency Amount for Posted, or Voucher Currency Amount for Draft)
      const eq = parseFloat(row.equivalent as string) || 0;
      const debit = parseFloat(row.debit as string) || 0;
      const credit = parseFloat(row.credit as string) || 0;

      if (debit > 0) {
        debitEqSum += eq || debit; 
      } else if (credit > 0) {
        creditEqSum += eq || credit;
      }
    });

    // Valid balance check is done on the summed values
    const isBalanced = Math.abs(debitEqSum - creditEqSum) < 0.05;

    // Calculate totals in VOUCHER CURRENCY
    // If convertFromBase is true (Posted/DB Loaded), 'equivalent' is in Base Currency, so we divide by Header Rate.
    // If false (Draft/Frontend), 'equivalent' is already in Voucher Currency, so we sum directly.
    const validatedHeaderRate = headerRate || 1;
    const totalDebitVoucher = convertFromBase ? (debitEqSum / validatedHeaderRate) : debitEqSum;
    const totalCreditVoucher = convertFromBase ? (creditEqSum / validatedHeaderRate) : creditEqSum;

    const differenceVoucher = Math.abs(totalDebitVoucher - totalCreditVoucher);

    return {
      totalDebitVoucher,
      totalCreditVoucher,
      isBalanced,
      differenceVoucher
    };
  }, [rows, headerRate, convertFromBase]);

  return { totalDebitVoucher, totalCreditVoucher, isBalanced, differenceVoucher };
};
