
import { VoucherLine } from './VoucherLine';

export type VoucherType = 'JOURNAL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'RECEIPT';
export type VoucherStatus = 'draft' | 'pending' | 'approved' | 'locked' | 'cancelled';

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
    public reference?: string,
    public lines: VoucherLine[] = []
  ) {}

  public isBalanced(): boolean {
    return Math.abs(this.totalDebit - this.totalCredit) < 0.01;
  }

  public canTransitionTo(newStatus: VoucherStatus): boolean {
    switch (this.status) {
      case 'draft':
        return newStatus === 'pending' || newStatus === 'cancelled';
      case 'pending':
        return newStatus === 'approved' || newStatus === 'cancelled' || newStatus === 'draft';
      case 'approved':
        return newStatus === 'locked' || newStatus === 'cancelled'; 
      case 'locked':
        return false; // Terminal state
      case 'cancelled':
        return false; // Terminal state
      default:
        return false;
    }
  }
}
