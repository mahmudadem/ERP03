
import { IAccountRepository, IVoucherRepository } from '../../../repository/interfaces/accounting';

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export class GetTrialBalanceUseCase {
  constructor(
    private accountRepo: IAccountRepository,
    private voucherRepo: IVoucherRepository
  ) {}

  async execute(companyId: string): Promise<TrialBalanceLine[]> {
    // 1. Fetch all accounts to map names and codes
    const accounts = await this.accountRepo.getAccounts(companyId);
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    
    // 2. Fetch all Approved or Locked vouchers
    const allVouchers = await this.voucherRepo.getVouchers(companyId);
    const validVouchers = allVouchers.filter(v => v.status === 'approved' || v.status === 'locked');

    // 3. Aggregate Balances
    // We use a Record to track balances. We pre-fill it with existing accounts to ensure
    // accounts with 0 balance still appear in the report.
    const balances: Record<string, { debit: number; credit: number }> = {};
    
    accounts.forEach(acc => {
      balances[acc.id] = { debit: 0, credit: 0 };
    });

    for (const voucher of validVouchers) {
      if (!voucher.lines) continue;
      
      for (const line of voucher.lines) {
        // Handle case where voucher references an account not in the current account list (orphaned)
        if (!balances[line.accountId]) {
          balances[line.accountId] = { debit: 0, credit: 0 };
        }
        
        // Base Amount is already in Company Base Currency
        if (line.baseAmount > 0) {
          balances[line.accountId].debit += line.baseAmount;
        } else {
          balances[line.accountId].credit += Math.abs(line.baseAmount);
        }
      }
    }

    // 4. Transform to Result
    // We iterate over keys of balances to ensure we include orphaned accounts found in vouchers
    const report: TrialBalanceLine[] = Object.keys(balances).map(accId => {
      const b = balances[accId];
      const acc = accountMap.get(accId);
      
      const code = acc?.code || '???';
      const name = acc?.name || `Unknown Account (${accId})`;
      const type = acc?.type || 'EXPENSE'; // Fallback type to prevent crash, ideally logged
      
      // Net Balance Logic: 
      // Assets/Expenses (Debit Normal): Debit - Credit
      // Liabilities/Equity/Income (Credit Normal): Credit - Debit
      let net = 0;
      if (['ASSET', 'EXPENSE'].includes(type)) {
        net = b.debit - b.credit;
      } else {
        net = b.credit - b.debit;
      }

      return {
        accountId: accId,
        code: code,
        name: name,
        type: type,
        totalDebit: b.debit,
        totalCredit: b.credit,
        netBalance: net
      };
    });

    // Sort by Account Code
    return report.sort((a, b) => a.code.localeCompare(b.code));
  }
}
