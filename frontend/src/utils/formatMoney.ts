// Currency display formatter. `Intl.NumberFormat` with `style: 'currency'` uses
// CLDR's per-currency minor-unit default — for SYP, KRW, JPY, ISK and others
// that's 0, which silently rounds 1.50 to "2" on every list, report and detail
// page. We always pass explicit fraction digits so the seeded `decimalPlaces`
// (2 for everything we currently support) wins over CLDR.
export const formatMoney = (
  amount: number,
  currency: string,
  decimalPlaces: number = 2,
): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(decimalPlaces)}`;
  }
};
