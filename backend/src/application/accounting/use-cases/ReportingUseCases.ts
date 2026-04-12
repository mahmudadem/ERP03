
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { ICostCenterRepository } from '../../../repository/interfaces/accounting/ICostCenterRepository';
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
  costCenterId?: string;
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
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;

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
    private permissionChecker: PermissionChecker,
    private costCenterRepo?: ICostCenterRepository
  ) {}

  async execute(companyId: string, userId: string, filters: GeneralLedgerFilters & { limit?: number; offset?: number }): Promise<{ data: GeneralLedgerEntry[], metadata: { totalItems: number, openingBalance: number } }> {
    // RBAC: Check permission
    await this.permissionChecker.assertOrThrow(
      userId,
      companyId,
      'accounting.reports.generalLedger.view'
    );

    // Prepare account scope (supports selecting header/group accounts for reporting)
    const accounts = this.accountRepo.getAccounts
      ? await this.accountRepo.getAccounts(companyId)
      : await this.accountRepo.list(companyId);
    const scopedAccountIds = this.resolveScopedAccountIds(filters.accountId, accounts);

    // 1. Calculate opening balance (all entries before fromDate)
    let openingBalance = 0;
    if (filters.fromDate) {
      try {
        const openingQuery: any = {
          toDate: new Date(new Date(filters.fromDate).getTime() - 1).toISOString().split('T')[0],
          costCenterId: filters.costCenterId,
        };
        if (!scopedAccountIds && filters.accountId) {
          openingQuery.accountId = filters.accountId;
        }
        const openingEntries = await this.ledgerRepo.getGeneralLedger(companyId, openingQuery);
        openingEntries.forEach(e => {
          if (this.belongsToScope(e.accountId, scopedAccountIds)) {
            openingBalance += ((e.debit || 0) - (e.credit || 0));
          }
        });
      } catch (e) {
        console.warn(`[GetGeneralLedger] Error calculating opening balance: ${e}`);
      }
    }

    // 2. Fetch entries (for count + pagination)
    const baseQuery: any = {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      costCenterId: filters.costCenterId,
    };
    if (!scopedAccountIds && filters.accountId) {
      baseQuery.accountId = filters.accountId;
    }
    const allEntries = await this.ledgerRepo.getGeneralLedger(companyId, baseQuery);
    const scopedEntries = scopedAccountIds
      ? allEntries.filter(e => this.belongsToScope(e.accountId, scopedAccountIds))
      : allEntries;
    const totalItems = scopedEntries.length;
    const offset = Math.max(0, filters.offset || 0);
    const limit = filters.limit && filters.limit > 0 ? filters.limit : totalItems || 100;
    const ledgerEntries = scopedEntries.slice(offset, offset + limit);

    // 3. Enrich account data
    
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const accountCodeMap = new Map(accounts.map(a => [a.userCode || (a as any).code, a]));

    // 4. Fetch vouchers
    const voucherIds = [...new Set(ledgerEntries.map(e => e.voucherId))];
    const vouchers = await Promise.all(
      voucherIds.map(id => this.voucherRepo.findById(companyId, id).catch(() => null))
    );
    const voucherMap = new Map(vouchers.filter(v => v).map(v => [v!.id, v!]));

    // 5. Enrichment missing accounts and users
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

    // 5b. Enrich cost center data
    const costCenterIds = new Set(ledgerEntries.map(e => e.costCenterId).filter(Boolean) as string[]);
    const costCenterMap = new Map<string, { code: string; name: string }>();
    if (costCenterIds.size > 0 && this.costCenterRepo) {
      try {
        const allCCs = await this.costCenterRepo.findAll(companyId);
        allCCs.forEach(cc => costCenterMap.set(cc.id, { code: cc.code, name: cc.name }));
      } catch (e) {
        console.warn('[GetGeneralLedger] Error loading cost centers:', e);
      }
    }

    // 6. Calculate Running Balance for the CURRENT page
    // We need the balance up to the offset
    let pageStartingBalance = openingBalance;
    if (offset > 0) {
      // Add balance from entries skipped by current offset
      scopedEntries.slice(0, offset).forEach(e => {
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
        costCenterId: entry.costCenterId || undefined,
        costCenterCode: entry.costCenterId ? costCenterMap.get(entry.costCenterId)?.code : undefined,
        costCenterName: entry.costCenterId ? costCenterMap.get(entry.costCenterId)?.name : undefined,
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

  private resolveScopedAccountIds(accountId: string | undefined, accounts: any[]): Set<string> | null {
    if (!accountId) return null;

    const byId = new Map(accounts.map((a: any) => [a.id, a]));
    const childrenMap = new Map<string | null, any[]>();
    for (const account of accounts) {
      const key = (account?.parentId as string | null) || null;
      const bucket = childrenMap.get(key) || [];
      bucket.push(account);
      childrenMap.set(key, bucket);
    }

    const scoped = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [accountId];

    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (visited.has(id)) continue;
      visited.add(id);

      const account = byId.get(id);
      if (!account) continue;

      const role = String(account?.accountRole || '').toUpperCase();
      const isHeader = role === 'HEADER' || account?.hasChildren === true;
      
      // Always include the account itself if it was the one explicitly requested, 
      // or if it is a posting account.
      if (id === accountId || !isHeader) {
        scoped.add(id);
      }

      const children = childrenMap.get(id) || [];
      children.forEach((child: any) => {
        if (child?.id && !visited.has(child.id)) queue.push(child.id);
      });
    }

    return scoped;
  }

  private belongsToScope(accountId: string, scopedAccountIds: Set<string> | null): boolean {
    if (!scopedAccountIds) return true;
    return scopedAccountIds.has(accountId);
  }
}

// Import for ILedgerRepository
import { ILedgerRepository, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
