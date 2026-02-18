
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { User } from '../../../domain/core/entities/User';

// GetTrialBalanceUseCase has been moved to LedgerUseCases.ts
// It now uses the posted General Ledger instead of voucher lines.


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

  async execute(companyId: string, userId: string, filters: GeneralLedgerFilters & { limit?: number; offset?: number }): Promise<{ data: GeneralLedgerEntry[], metadata: { totalItems: number, openingBalance: number } }> {
    // RBAC: Check permission
    await this.permissionChecker.assertOrThrow(
      userId,
      companyId,
      'accounting.reports.generalLedger.view'
    );

    // 1. Calculate opening balance (all entries before fromDate)
    let openingBalance = 0;
    if (filters.accountId && filters.fromDate) {
      try {
        const openingEntries = await this.ledgerRepo.getGeneralLedger(companyId, {
          accountId: filters.accountId,
          toDate: new Date(new Date(filters.fromDate).getTime() - 1).toISOString().split('T')[0],
        });
        openingEntries.forEach(e => {
          openingBalance += ((e.debit || 0) - (e.credit || 0));
        });
      } catch (e) {
        console.warn(`[GetGeneralLedger] Error calculating opening balance: ${e}`);
      }
    }

    // 2. Fetch total count (for pagination)
    // Firestore lacks count() in standard get(), but since it's a report we might fetch all IDs or use a separate counter
    // For V1 Reports, we just fetch IDs for count if accountId is provided.
    const allEntriesCountSnap = await this.ledgerRepo.getGeneralLedger(companyId, {
      accountId: filters.accountId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    });
    const totalItems = allEntriesCountSnap.length;

    // 3. Fetch paginated entries
    const ledgerEntries = await this.ledgerRepo.getGeneralLedger(companyId, {
      accountId: filters.accountId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      limit: filters.limit,
      offset: filters.offset
    });

    // 4. Enrich account data
    const accounts = this.accountRepo.getAccounts
      ? await this.accountRepo.getAccounts(companyId)
      : await this.accountRepo.list(companyId);
    
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const accountCodeMap = new Map(accounts.map(a => [a.userCode || (a as any).code, a]));

    // 5. Fetch vouchers
    const voucherIds = [...new Set(ledgerEntries.map(e => e.voucherId))];
    const vouchers = await Promise.all(
      voucherIds.map(id => this.voucherRepo.findById(companyId, id).catch(() => null))
    );
    const voucherMap = new Map(vouchers.filter(v => v).map(v => [v!.id, v!]));

    // 6. Enrichment missing accounts and users
    const userIds = new Set<string>();
    voucherMap.forEach(v => {
      if (v.createdBy) userIds.add(v.createdBy);
      if (v.approvedBy) userIds.add(v.approvedBy);
      if (v.postedBy) userIds.add(v.postedBy);
    });

    const userMap = new Map<string, User>();
    if (userIds.size > 0) {
      await Promise.all(Array.from(userIds).map(async uid => {
         try {
           const u = await this.userRepo.getUserById(uid);
           if (u) userMap.set(uid, u);
         } catch (e) {}
      }));
    }

    // 7. Calculate Running Balance for the CURRENT page
    // We need the balance up to the offset
    let pageStartingBalance = openingBalance;
    if (filters.offset && filters.offset > 0) {
      // Add balance from entries skipped by current offset
      allEntriesCountSnap.slice(0, filters.offset).forEach(e => {
        pageStartingBalance += ((e.debit || 0) - (e.credit || 0));
      });
    }

    let runningBalance = pageStartingBalance;
    const data: GeneralLedgerEntry[] = ledgerEntries.map(entry => {
      const acc = accountMap.get(entry.accountId) || accountCodeMap.get(entry.accountId);
      const voucher = voucherMap.get(entry.voucherId);
      
      const dr = entry.debit || 0;
      const cr = entry.credit || 0;
      runningBalance += (dr - cr);

      return {
        id: entry.id,
        date: entry.date as any, // Mappers will handle
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
        runningBalance: filters.accountId ? runningBalance : undefined,
      };
    });

    return { 
      data, 
      metadata: { 
        totalItems, 
        openingBalance 
      } 
    };
  }
}

// Import for ILedgerRepository
import { ILedgerRepository, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
