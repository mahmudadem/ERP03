export type BankStatementMatchStatus = 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUAL_MATCHED';

export interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  balance?: number;
  matchedLedgerEntryId?: string;
  matchStatus: BankStatementMatchStatus;
}

export class BankStatement {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly accountId: string,
    public readonly bankName: string,
    public readonly statementDate: string,
    public readonly importedAt: Date,
    public readonly importedBy: string,
    public readonly lines: BankStatementLine[] = []
  ) {}

  withLines(lines: BankStatementLine[]) {
    return new BankStatement(
      this.id,
      this.companyId,
      this.accountId,
      this.bankName,
      this.statementDate,
      this.importedAt,
      this.importedBy,
      lines
    );
  }
}
