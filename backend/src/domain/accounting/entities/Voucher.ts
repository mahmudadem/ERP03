
export type VoucherType = 'JOURNAL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'RECEIPT';
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'VOID';

export class Voucher {
  constructor(
    public id: string,
    public companyId: string,
    public type: VoucherType,
    public date: Date,
    public currency: string,
    public exchangeRate: number,
    public status: VoucherStatus,
    public totalDebit: number,
    public totalCredit: number,
    public createdBy: string,
    public reference?: string
  ) {}

  public isBalanced(): boolean {
    return Math.abs(this.totalDebit - this.totalCredit) < 0.01;
  }
}
