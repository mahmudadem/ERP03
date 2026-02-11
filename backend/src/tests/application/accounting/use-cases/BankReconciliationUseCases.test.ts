import { BankReconciliationUseCases } from '../../../../application/accounting/use-cases/BankReconciliationUseCases';
import { IBankStatementRepository } from '../../../../repository/interfaces/accounting/IBankStatementRepository';
import { IReconciliationRepository } from '../../../../repository/interfaces/accounting/IReconciliationRepository';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { IVoucherRepository } from '../../../../domain/accounting/repositories/IVoucherRepository';
import { PermissionChecker } from '../../../../application/rbac/PermissionChecker';
import { BankStatement } from '../../../../domain/accounting/entities/BankStatement';
import { Reconciliation } from '../../../../domain/accounting/entities/Reconciliation';

const noopPermissionChecker = {
  assertOrThrow: async () => {}
} as unknown as PermissionChecker;

class MemoryBankRepo implements IBankStatementRepository {
  data: Record<string, BankStatement> = {};
  async save(s: BankStatement) {
    this.data[s.id] = s;
    return s;
  }
  async findById(companyId: string, id: string) {
    return this.data[id] || null;
  }
  async list() {
    return Object.values(this.data);
  }
  async updateLineMatch(companyId: string, statementId: string, lineId: string, matchStatus: any, ledgerEntryId?: string) {
    const stmt = this.data[statementId];
    const lines = stmt.lines.map((l) => (l.id === lineId ? { ...l, matchStatus, matchedLedgerEntryId: ledgerEntryId } : l));
    this.data[statementId] = stmt.withLines(lines);
  }
}

class MemoryReconciliationRepo implements IReconciliationRepository {
  recs: Reconciliation[] = [];
  async save(r: Reconciliation) {
    this.recs.push(r);
    return r;
  }
  async update(r: Reconciliation) {
    const idx = this.recs.findIndex((x) => x.id === r.id);
    if (idx >= 0) this.recs[idx] = r;
  }
  async findLatestForAccount(companyId: string, accountId: string) {
    return this.recs.find((r) => r.accountId === accountId) || null;
  }
  async list() {
    return this.recs;
  }
}

class MemoryLedgerRepo implements ILedgerRepository {
  entries: any[] = [];
  constructor(entries: any[]) {
    this.entries = entries;
  }
  async recordForVoucher(): Promise<void> {}
  async deleteForVoucher(): Promise<void> {}
  async getAccountLedger(): Promise<any[]> { return []; }
  async getTrialBalance(): Promise<any[]> { return []; }
  async getGeneralLedger(): Promise<any[]> { return []; }
  async getAccountStatement(): Promise<any> {
    return { closingBalance: 0 };
  }
  async getUnreconciledEntries(): Promise<any[]> {
    return this.entries;
  }
  async markReconciled(): Promise<void> {}
}

const emptyVoucherRepo = { save: async () => {}, findById: async () => null } as unknown as IVoucherRepository;
const dummyCompanyRepo = { findById: async () => ({ baseCurrency: 'USD' }) } as any;

describe('BankReconciliationUseCases auto-match', () => {
  it('auto matches by amount and date', async () => {
    const bankRepo = new MemoryBankRepo();
    const recRepo = new MemoryReconciliationRepo();
    const ledgerRepo = new MemoryLedgerRepo([
      { id: 'l1', amount: 100, side: 'Debit', date: '2026-01-05' },
      { id: 'l2', amount: 50, side: 'Debit', date: '2026-01-07' }
    ]);

    const uc = new BankReconciliationUseCases(
      bankRepo,
      recRepo,
      ledgerRepo,
      emptyVoucherRepo,
      dummyCompanyRepo,
      noopPermissionChecker
    );

    const stmt = await uc.importStatement('c1', 'u1', {
      accountId: 'acc1',
      bankName: 'Test',
      statementDate: '2026-01-10',
      format: 'csv',
      content: 'date,description,amount\n2026-01-05,Deposit,100\n2026-01-08,Deposit,50',
      columnMap: {}
    });

    expect(stmt.lines.filter((l) => l.matchedLedgerEntryId).length).toBe(2);
    expect(stmt.lines[0].matchedLedgerEntryId).toBe('l1');
    expect(stmt.lines[1].matchedLedgerEntryId).toBe('l2');
  });
});
