import { VoucherLine } from './VoucherLine';

export class Voucher {
  constructor(
    public id: string,
    public companyId: string,
    public type: string,
    public date: Date | string,
    public currency: string,
    public exchangeRate: number,
    public status: string,
    public totalDebit: number,
    public totalCredit: number,
    public createdBy: string,
    public reference: string | null = null,
    public lines: VoucherLine[] = []
  ) {}

  // Optional extended props for compatibility with DTOs/use-cases
  public voucherNo?: string;
  public baseCurrency?: string;
  public totalDebitBase?: number;
  public totalCreditBase?: number;
  public createdAt?: string | Date;
  public updatedAt?: string | Date;
  public approvedBy?: string;
  public lockedBy?: string;
  public description?: string | null;
  public sourceModule?: 'accounting' | 'pos' | 'inventory' | 'hr' | string; // Track origin module
}
