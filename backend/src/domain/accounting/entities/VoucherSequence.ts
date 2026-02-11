export interface VoucherSequence {
  id: string; // prefix or prefix-year
  companyId: string;
  prefix: string;
  year?: number;
  lastNumber: number;
  format: string; // e.g. "{PREFIX}-{COUNTER:4}" or "{PREFIX}-{YYYY}-{COUNTER:4}"
  updatedAt: Date;
}
