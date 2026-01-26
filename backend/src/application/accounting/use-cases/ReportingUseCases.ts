
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { User } from '../../../domain/core/entities/User';

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
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string): Promise<TrialBalanceLine[]> {
    // RBAC: Check permission
    await this.permissionChecker.assertOrThrow(
      userId,
      companyId,
      'accounting.reports.trialBalance.view'
    );

    // 1. Fetch all accounts to map names and codes
    const accounts = this.accountRepo.getAccounts
      ? await this.accountRepo.getAccounts(companyId)
      : await this.accountRepo.list(companyId);
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    
    // 2. Fetch all vouchers and filter by status (V1: use isApproved and isPosted)
    const allVouchers = await this.voucherRepo.findByCompany(companyId) || [];
    // V1: Include APPROVED vouchers (which may or may not be posted) and any posted vouchers
    const validVouchers = allVouchers.filter(v => v.isApproved || v.isPosted);

    // 3. Aggregate Balances
    const balances: Record<string, { debit: number; credit: number }> = {};
    
    accounts.forEach(acc => {
      balances[acc.id] = { debit: 0, credit: 0 };
    });

    for (const voucher of validVouchers) {
      if (!voucher.lines) continue;
      
      for (const line of voucher.lines) {
        if (!balances[line.accountId]) {
          balances[line.accountId] = { debit: 0, credit: 0 };
        }
        
        // V2 VoucherLineEntity uses debitAmount/creditAmount getters
        balances[line.accountId].debit += line.debitAmount || 0;
        balances[line.accountId].credit += line.creditAmount || 0;
      }
    }

    // 4. Transform to Result
    const report: TrialBalanceLine[] = Object.keys(balances).map(accId => {
      const b = balances[accId];
      const acc = accountMap.get(accId);
      
      const code = acc?.code || '???';
      const name = acc?.name || `Unknown Account (${accId})`;
      const type = acc?.type || 'EXPENSE';
      
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

// ============================================================================
// GetGeneralLedgerUseCase
// ============================================================================

export interface GeneralLedgerFilters {
  accountId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface GeneralLedgerEntry {
  id: string;
  date: string;
  voucherId: string;
  voucherNo?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description?: string;
  debit: number;
  credit: number;
  currency: string;
  amount: number;
  baseCurrency: string;
  baseAmount: number;
  exchangeRate: number;
  runningBalance?: number;

  // Audit Metadata
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  
  postedAt?: string;
  postedBy?: string;
  postedByName?: string;
  postedByEmail?: string;
}

export class GetGeneralLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private voucherRepo: IVoucherRepository,
    private userRepo: IUserRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GeneralLedgerFilters): Promise<GeneralLedgerEntry[]> {
    // RBAC: Check permission
    await this.permissionChecker.assertOrThrow(
      userId,
      companyId,
      'accounting.reports.generalLedger.view'
    );

    // 1. Fetch ledger entries
    const ledgerEntries = await this.ledgerRepo.getGeneralLedger(companyId, {
      accountId: filters.accountId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    });

    // 2. Fetch accounts for enrichment (Batch)
    const accounts = this.accountRepo.getAccounts
      ? await this.accountRepo.getAccounts(companyId)
      : await this.accountRepo.list(companyId);
    console.log(`[GetGeneralLedger] CompanyId: ${companyId}, Fetched ${accounts.length} accounts`);
    
    // Create maps for both ID and UserCode for robustness
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const accountCodeMap = new Map(accounts.map(a => [a.userCode || (a as any).code, a]));

    // 3. Fetch vouchers for voucher numbers
    const voucherIds = [...new Set(ledgerEntries.map(e => e.voucherId))];
    const vouchers = await Promise.all(
      voucherIds.map(id => this.voucherRepo.findById(companyId, id).catch(() => null))
    );
    const voucherMap = new Map(vouchers.filter(v => v).map(v => [v!.id, v!]));

    // 5. Fetch Users for Audit Metadata
    const userIds = new Set<string>();
    voucherMap.forEach(v => {
      if (v.createdBy) userIds.add(v.createdBy);
      if (v.approvedBy) userIds.add(v.approvedBy);
      if (v.postedBy) userIds.add(v.postedBy);
    });

    const userMap = new Map<string, User>();
    if (userIds.size > 0) {
      console.log(`[GetGeneralLedger] Fetching details for ${userIds.size} users...`);
      await Promise.all(Array.from(userIds).map(async uid => {
         try {
           const u = await this.userRepo.getUserById(uid);
           if (u) userMap.set(uid, u);
         } catch (e) {
           console.warn(`[GetGeneralLedger] Failed to fetch user ${uid}`, e);
         }
      }));
    }

    // 4. Transform and enrich
    let runningBalance = 0;
    
    // Pre-fetch missing accounts to handle pagination/limit issues
    const validAccountIds = new Set([...accountMap.keys()]);
    const missingAccountIds = [...new Set(ledgerEntries.map(e => e.accountId))]
      .filter(id => !validAccountIds.has(id));

    if (missingAccountIds.length > 0) {
      console.log(`[GetGeneralLedger] Found ${missingAccountIds.length} accounts missing from batch list. Fetching individually...`);
      // Try to fetch missing accounts individually (or in batch if repo supports it)
      // Since repo doesn't support getManyByIds, we fetch individually (parallel)
      await Promise.all(missingAccountIds.map(async (id) => {
         try {
           const acc = await this.accountRepo.getById(companyId, id);
           if (acc) {
             accountMap.set(acc.id, acc);
             if (acc.userCode) accountCodeMap.set(acc.userCode, acc);
             if ((acc as any).code) accountCodeMap.set((acc as any).code, acc);
           }
         } catch (e) {
           console.warn(`[GetGeneralLedger] Failed to lazy-load account ${id}`, e);
         }
      }));
    }

    const result: GeneralLedgerEntry[] = ledgerEntries.map(entry => {
      // Try ID first, then UserCode
      const acc = accountMap.get(entry.accountId) || accountCodeMap.get(entry.accountId);
      const voucher = voucherMap.get(entry.voucherId);
      
      const dateStr = (() => {
        const d = entry.date;
        if (!d) return '';
        if (d instanceof Date) return d.toISOString().split('T')[0];
        if (typeof d === 'string') return d.includes('T') ? d.split('T')[0] : d;
        if (typeof d === 'object' && 'seconds' in d) {
          return new Date((d as any).seconds * 1000).toISOString().split('T')[0];
        }
        return String(d);
      })();

      // Update running balance (Debit positive, Credit negative)
      // Note: This logic assumes Asset/Expense nature. For Liabilities/Revenue, it might be inverted,
      // but standard GL view usually presents Dr-Cr or separate columns.
      const dr = entry.debit || 0;
      const cr = entry.credit || 0;
      runningBalance += (dr - cr);

      return {
        id: entry.id,
        date: dateStr,
        voucherId: entry.voucherId,
        voucherNo: voucher?.voucherNo || 'N/A',
        accountId: entry.accountId,
        accountCode: acc?.code || '???',
        accountName: acc?.name || 'Unknown Account',
        description: entry.notes || voucher?.description || '',
        debit: dr,
        credit: cr,
        currency: entry.currency || '',
        amount: entry.amount || 0,
        baseCurrency: entry.baseCurrency || '',
        baseAmount: entry.baseAmount || 0,
        exchangeRate: entry.exchangeRate || 1,
        runningBalance: filters.accountId ? runningBalance : undefined, // Only show for single account
        
        // Audit Metadata
        createdAt: voucher?.createdAt ? new Date(voucher.createdAt).toISOString() : undefined,
        createdBy: voucher?.createdBy,
        createdByName: userMap.get(voucher?.createdBy || '')?.name,
        createdByEmail: userMap.get(voucher?.createdBy || '')?.email,
        
        approvedAt: voucher?.approvedAt ? new Date(voucher.approvedAt).toISOString() : undefined,
        approvedBy: voucher?.approvedBy,
        approvedByName: userMap.get(voucher?.approvedBy || '')?.name,
        approvedByEmail: userMap.get(voucher?.approvedBy || '')?.email,
        
        postedAt: voucher?.postedAt ? new Date(voucher.postedAt).toISOString() : undefined,
        postedBy: voucher?.postedBy,
        postedByName: userMap.get(voucher?.postedBy || '')?.name,
        postedByEmail: userMap.get(voucher?.postedBy || '')?.email,
      };
    });

    return result;
  }
}

// Import for ILedgerRepository
import { ILedgerRepository, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
