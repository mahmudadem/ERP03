const DEFAULT_DATE_KEYS = [
  'createdAt',
  'postedAt',
  'closedAt',
  'reprintedAt',
  'date',
  'documentDate',
  'voucherDate',
  'invoiceDate',
  'orderDate',
  'returnDate',
  'deliveryDate',
];

export const getReportDateTimeValue = (
  row: object,
  preferredKeys: string[] = DEFAULT_DATE_KEYS
): number => {
  for (const key of preferredKeys) {
    const value = (row as Record<string, unknown>)[key];
    if (!value) continue;
    const timestamp = new Date(value as string | number | Date).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
};

export const sortReportRowsByDateTimeDesc = <T extends object>(
  rows: T[],
  preferredKeys?: string[]
): T[] => {
  return [...rows].sort((left, right) => (
    getReportDateTimeValue(right, preferredKeys) - getReportDateTimeValue(left, preferredKeys)
  ));
};
