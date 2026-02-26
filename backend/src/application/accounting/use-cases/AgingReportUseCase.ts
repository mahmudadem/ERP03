import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

export type AgingType = 'AR' | 'AP';

export interface AgingAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  bucketAmounts: number[];
  total: number;
  entries?: Array<{
    id: string;
    date: string;
    description?: string;
    amount: number;
    days: number;
  }>;
}

export interface AgingReportData {
  asOfDate: string;
  type: AgingType;
  buckets: string[];
  accounts: AgingAccountRow[];
  totals: number[];
  grandTotal: number;
}

const BUCKETS = [
  { name: 'Current', min: 0, max: 0 },
  { name: '1-30', min: 1, max: 30 },
  { name: '31-60', min: 31, max: 60 },
  { name: '61-90', min: 61, max: 90 },
  { name: '91-120', min: 91, max: 120 },
  { name: '120+', min: 121, max: Number.MAX_SAFE_INTEGER }
];

const AR_MARKERS = [
  'accounts receivable',
  'account receivable',
  'receivable',
  'receivables',
  'trade receivable',
  'customer receivable',
  'customers receivable',
  'client receivable',
  'debtor',
  'debtors',
  'unbilled',
  'ذمم مدينة',
  'مدين',
  'عملاء',
];

const AP_MARKERS = [
  'accounts payable',
  'account payable',
  'trade payable',
  'payables',
  'supplier',
  'suppliers',
  'vendor',
  'vendors',
  'creditor',
  'creditors',
  'ذمم دائنة',
  'دائن',
  'مورد',
  'موردين',
];

export class AgingReportUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(
    companyId: string,
    userId: string,
    type: AgingType,
    asOfDate: string,
    accountId?: string,
    includeZeroBalance = false
  ): Promise<AgingReportData> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');

    const accounts = await this.accountRepo.list(companyId);
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
    const scopedAccountIds = this.resolveScopedAccountIds(accountId, accounts);
    const isManualAccountMode = !!accountId;
    const targetAccounts = accounts.filter((a: any) =>
      this.isTargetAgingAccount(a, type, scopedAccountIds, isManualAccountMode, accountMap)
    );

    const rows: AgingAccountRow[] = [];
    const totals = Array(BUCKETS.length).fill(0);

    for (const acc of targetAccounts) {
      const ledger = await this.ledgerRepo.getGeneralLedger(companyId, { accountId: acc.id, toDate: asOfDate });
      const bucketSums = Array(BUCKETS.length).fill(0);
      const entryDetails: AgingAccountRow['entries'] = [];

      ledger.forEach((e: any) => {
        const days = this.daysBetween(asOfDate, e.date);
        const amount = this.signedAmount(type, e.side, e.amount);
        const idx = this.bucketIndex(days);
        if (idx >= 0) {
          bucketSums[idx] += amount;
          entryDetails.push({
            id: e.id,
            date: typeof e.date === 'string' ? e.date : '',
            description: e.description || e.notes,
            amount,
            days
          });
        }
      });

      const total = bucketSums.reduce((s, v) => s + v, 0);
      if (!includeZeroBalance && Math.abs(total) < 0.0001) continue; // skip zero-balance accounts by default

      bucketSums.forEach((v, i) => (totals[i] += v));

      rows.push({
        accountId: acc.id,
        accountCode: acc.userCode || acc.code || '',
        accountName: acc.name,
        bucketAmounts: bucketSums,
        total,
        entries: entryDetails.sort((a, b) => b.days - a.days)
      });
    }

    const grandTotal = totals.reduce((s, v) => s + v, 0);

    return {
      asOfDate,
      type,
      buckets: BUCKETS.map((b) => b.name),
      accounts: rows,
      totals,
      grandTotal
    };
  }

  private daysBetween(asOf: string, dateStr: any): number {
    const asOfDate = new Date(asOf);
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
    const diff = asOfDate.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 3600 * 24));
  }

  private bucketIndex(days: number): number {
    for (let i = 0; i < BUCKETS.length; i++) {
      if (days >= BUCKETS[i].min && days <= BUCKETS[i].max) return i;
    }
    return -1;
  }

  private signedAmount(type: AgingType, side: string, amount: number): number {
    const amt = Number(amount) || 0;
    if (type === 'AR') {
      return side === 'Credit' ? -amt : amt;
    }
    // AP: payable grows on credit
    return side === 'Credit' ? amt : -amt;
  }

  private isTargetAgingAccount(
    account: any,
    type: AgingType,
    scopedAccountIds: Set<string> | null,
    isManualAccountMode: boolean,
    accountMap: Map<string, any>
  ): boolean {
    if (scopedAccountIds && !scopedAccountIds.has(account.id)) return false;

    const role = String(account?.accountRole || '').toUpperCase();
    const classification = String(account?.classification || '').toUpperCase();
    const isLegacyRoleMatch = type === 'AR'
      ? ['RECEIVABLE', 'AR', 'ACCOUNTS_RECEIVABLE'].includes(role)
      : ['PAYABLE', 'AP', 'ACCOUNTS_PAYABLE'].includes(role);
    const isClassificationMatch = type === 'AR'
      ? classification === 'ASSET'
      : classification === 'LIABILITY';

    if (!isLegacyRoleMatch && !isClassificationMatch) return false;
    if (!this.isPostingLikeAccount(account, role)) return false;
    if (isLegacyRoleMatch) return true;
    if (isManualAccountMode) return true;

    const markers = type === 'AR' ? AR_MARKERS : AP_MARKERS;
    return this.hasMarkerInHierarchy(account, accountMap, markers);
  }

  private isPostingLikeAccount(account: any, role: string): boolean {
    if (role === 'HEADER') return false;
    if (account?.hasChildren === true) return false;
    return true;
  }

  private hasMarkerInHierarchy(account: any, accountMap: Map<string, any>, markers: string[]): boolean {
    let current: any = account;
    const seen = new Set<string>();

    for (let depth = 0; depth < 20 && current; depth++) {
      const text = `${current?.name || ''} ${current?.userCode || current?.code || ''}`.toLowerCase();
      if (markers.some((marker) => text.includes(marker))) return true;

      const parentId = current?.parentId;
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      current = accountMap.get(parentId);
    }

    return false;
  }

  private resolveScopedAccountIds(accountId: string | undefined, accounts: any[]): Set<string> | null {
    if (!accountId) return null;

    const ids = new Set<string>();
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
    const childrenMap = new Map<string | null, any[]>();

    for (const account of accounts) {
      const key = (account?.parentId as string | null) || null;
      const bucket = childrenMap.get(key) || [];
      bucket.push(account);
      childrenMap.set(key, bucket);
    }

    const queue: string[] = [accountId];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      if (seen.has(currentId)) continue;
      seen.add(currentId);

      const current = accountMap.get(currentId);
      if (!current) continue;

      ids.add(currentId);
      const children = childrenMap.get(currentId) || [];
      children.forEach((child: any) => {
        if (child?.id && !seen.has(child.id)) queue.push(child.id);
      });
    }

    return ids;
  }
}
