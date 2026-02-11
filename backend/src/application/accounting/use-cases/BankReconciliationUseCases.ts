import { v4 as uuidv4 } from 'uuid';
import { BankStatement, BankStatementLine, BankStatementMatchStatus } from '../../../domain/accounting/entities/BankStatement';
import { Reconciliation, ReconciliationAdjustment } from '../../../domain/accounting/entities/Reconciliation';
import { IBankStatementRepository } from '../../../repository/interfaces/accounting/IBankStatementRepository';
import { IReconciliationRepository } from '../../../repository/interfaces/accounting/IReconciliationRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export interface ImportBankStatementPayload {
  accountId: string;
  bankName: string;
  statementDate: string;
  format: 'csv' | 'ofx';
  content: string;
  columnMap?: Partial<Record<'date' | 'description' | 'reference' | 'amount' | 'balance', string>>;
}

export interface AdjustmentInput {
  type: 'BANK_FEE' | 'INTEREST' | 'OTHER';
  description: string;
  amount: number;
  currency: string;
  debitAccountId?: string;
  creditAccountId?: string;
}

export class BankReconciliationUseCases {
  constructor(
    private readonly bankStatements: IBankStatementRepository,
    private readonly reconciliations: IReconciliationRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async importStatement(companyId: string, userId: string, payload: ImportBankStatementPayload) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');

    const lines =
      payload.format === 'ofx'
        ? this.parseOfx(payload.content)
        : this.parseCsv(payload.content, payload.columnMap || {});

    const statement = new BankStatement(
      uuidv4(),
      companyId,
      payload.accountId,
      payload.bankName || 'Bank',
      payload.statementDate,
      new Date(),
      userId,
      lines
    );

    // Persist
    await this.bankStatements.save(statement);

    // Auto-match based on ledger entries
    const matchedLines = await this.autoMatch(companyId, statement);
    const updated = statement.withLines(matchedLines);
    await this.bankStatements.save(updated);

    return updated;
  }

  async listStatements(companyId: string, userId: string, accountId?: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    return this.bankStatements.list(companyId, accountId);
  }

  async getReconciliation(companyId: string, userId: string, accountId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    const latest = await this.reconciliations.findLatestForAccount(companyId, accountId);
    const statement = latest ? await this.bankStatements.findById(companyId, latest.bankStatementId) : null;
    const ledger = await this.ledgerRepo.getUnreconciledEntries(companyId, accountId);
    return { reconciliation: latest, statement, unreconciledLedger: ledger };
  }

  async manualMatch(companyId: string, userId: string, statementId: string, lineId: string, ledgerEntryId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    await this.bankStatements.updateLineMatch(companyId, statementId, lineId, 'MANUAL_MATCHED', ledgerEntryId);
    return { success: true };
  }

  async complete(
    companyId: string,
    userId: string,
    accountId: string,
    statementId: string,
    adjustments: AdjustmentInput[] = []
  ) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');

    const statement = await this.bankStatements.findById(companyId, statementId);
    if (!statement) throw new Error('Statement not found');

    const periodEnd = statement.statementDate;
    const accountLedger = await this.ledgerRepo.getAccountStatement(companyId, accountId, '1900-01-01', periodEnd);
    const bankBalance = this.computeBankBalance(statement.lines);

    // create adjustments (optional vouchers)
    const reconciliationAdjustments: ReconciliationAdjustment[] = [];
    for (const adj of adjustments) {
      let voucherId: string | undefined;
      if (adj.debitAccountId && adj.creditAccountId) {
        voucherId = await this.createAdjustmentVoucher(companyId, userId, adj, accountId);
      }
      reconciliationAdjustments.push({
        id: uuidv4(),
        type: adj.type,
        description: adj.description,
        amount: adj.amount,
        currency: adj.currency,
        voucherId
      });
    }

    const reconciliation = new Reconciliation(
      uuidv4(),
      companyId,
      accountId,
      statement.id,
      periodEnd,
      accountLedger.closingBalance,
      bankBalance,
      reconciliationAdjustments,
      'COMPLETED',
      new Date(),
      userId
    );
    await this.reconciliations.save(reconciliation);

    // Mark matched ledger entries as reconciled
    const matched = statement.lines.filter((l) => l.matchedLedgerEntryId);
    for (const line of matched) {
      await this.ledgerRepo.markReconciled(companyId, line.matchedLedgerEntryId!, reconciliation.id, line.id);
    }

    return reconciliation;
  }

  private async autoMatch(companyId: string, statement: BankStatement): Promise<BankStatementLine[]> {
    const from = statement.lines.length ? statement.lines[0].date : statement.statementDate;
    const to = statement.lines.length ? statement.lines[statement.lines.length - 1].date : statement.statementDate;
    const ledger = await this.ledgerRepo.getUnreconciledEntries(companyId, statement.accountId, from, to);

    const available = [...ledger];
    const matched: BankStatementLine[] = [];

    for (const line of statement.lines) {
      let match: any = null;

      // exact reference match
      if (line.reference) {
        match = available.find(
          (e) =>
            (e.voucherId && e.voucherId.includes(line.reference!)) ||
            (e.notes && e.notes.includes(line.reference!)) ||
            (e.metadata && Object.values(e.metadata).join(' ').includes(line.reference!))
        );
      }

      if (!match) {
        const amount = Number(line.amount || 0);
        match = available.find((e) => {
          const signed = e.side === 'Debit' ? e.amount : -e.amount;
          const sameAmount = Math.abs(signed - amount) < 0.01;
          if (!sameAmount) return false;
          const entryDate = new Date(e.date?.toDate ? e.date.toDate() : e.date);
          const stmtDate = new Date(line.date);
          const diff = Math.abs(entryDate.getTime() - stmtDate.getTime()) / (1000 * 3600 * 24);
          return diff <= 3;
        });
      }

      let status: BankStatementMatchStatus = 'UNMATCHED';
      if (match) {
        status = 'AUTO_MATCHED';
        // remove from available
        const idx = available.findIndex((e) => e.id === match.id);
        if (idx >= 0) available.splice(idx, 1);
      }

      matched.push({
        ...line,
        matchStatus: status,
        matchedLedgerEntryId: match?.id
      });
    }

    return matched;
  }

  private parseCsv(content: string, columnMap: Partial<Record<'date' | 'description' | 'reference' | 'amount' | 'balance', string>>): BankStatementLine[] {
    const map = {
      date: columnMap.date || 'date',
      description: columnMap.description || 'description',
      reference: columnMap.reference || 'reference',
      amount: columnMap.amount || 'amount',
      balance: columnMap.balance || 'balance'
    };

    const lines = content
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const get = (row: string[], key: string) => {
      const idx = headers.indexOf(map[key as keyof typeof map]);
      return idx >= 0 ? row[idx] : '';
    };

    return lines.slice(1).map((line, idx) => {
      const row = line.split(',').map((c) => c.replace(/^\"|\"$/g, '').trim());
      return {
        id: uuidv4(),
        date: get(row, 'date'),
        description: get(row, 'description'),
        reference: get(row, 'reference'),
        amount: Number(get(row, 'amount') || 0),
        balance: get(row, 'balance') ? Number(get(row, 'balance')) : undefined,
        matchStatus: 'UNMATCHED' as BankStatementMatchStatus
      };
    });
  }

  private parseOfx(content: string): BankStatementLine[] {
    const lines: BankStatementLine[] = [];
    const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match: RegExpExecArray | null;
    while ((match = trnRegex.exec(content))) {
      const block = match[1];
      const getTag = (tag: string) => {
        const m = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i').exec(block);
        return m ? m[1].trim() : '';
      };
      const date = getTag('DTPOSTED').slice(0, 8); // YYYYMMDD
      const yyyy = date.slice(0, 4);
      const mm = date.slice(4, 6);
      const dd = date.slice(6, 8);
      lines.push({
        id: uuidv4(),
        date: `${yyyy}-${mm}-${dd}`,
        description: getTag('NAME') || getTag('MEMO'),
        reference: getTag('FITID'),
        amount: Number(getTag('TRNAMT') || 0),
        balance: undefined,
        matchStatus: 'UNMATCHED'
      });
    }
    return lines;
  }

  private computeBankBalance(lines: BankStatementLine[]): number {
    if (!lines.length) return 0;
    const lastWithBalance = [...lines].reverse().find((l) => typeof l.balance === 'number');
    if (lastWithBalance && typeof lastWithBalance.balance === 'number') {
      return lastWithBalance.balance;
    }
    return lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }

  private async createAdjustmentVoucher(
    companyId: string,
    userId: string,
    adj: AdjustmentInput,
    bankAccountId: string
  ): Promise<string | undefined> {
    try {
      const company = await this.companyRepo.findById(companyId);
      const baseCurrency = (company as any)?.baseCurrency || adj.currency;
      const amount = Math.abs(adj.amount);
      const debitLine = new VoucherLineEntity(
        1,
        adj.debitAccountId || bankAccountId,
        'Debit',
        amount,
        baseCurrency,
        amount,
        adj.currency,
        1,
        adj.description
      );
      const creditLine = new VoucherLineEntity(
        2,
        adj.creditAccountId || bankAccountId,
        'Credit',
        amount,
        baseCurrency,
        amount,
        adj.currency,
        1,
        adj.description
      );

      const voucher = new VoucherEntity(
        uuidv4(),
        companyId,
        `RCN-${Date.now()}`,
        VoucherType.JOURNAL_ENTRY,
        new Date().toISOString().slice(0, 10),
        adj.description,
        adj.currency,
        baseCurrency,
        1,
        [debitLine, creditLine],
        amount,
        amount,
        VoucherStatus.APPROVED,
        { source: 'bank-reconciliation', adjustmentType: adj.type },
        userId,
        new Date(),
        userId,
        new Date(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        userId,
        new Date(),
        undefined,
        undefined,
        undefined,
        undefined
      );

      await this.voucherRepo.save(voucher);
      await this.ledgerRepo.recordForVoucher(voucher);
      return voucher.id;
    } catch (e) {
      console.warn('[BankReconciliation] Failed to create adjustment voucher', e);
      return undefined;
    }
  }
}
