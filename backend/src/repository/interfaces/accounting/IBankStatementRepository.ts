import { BankStatement, BankStatementLine } from '../../../domain/accounting/entities/BankStatement';

export interface ImportBankStatementInput {
  companyId: string;
  accountId: string;
  bankName: string;
  statementDate: string;
  lines: BankStatementLine[];
}

export interface IBankStatementRepository {
  save(statement: BankStatement): Promise<BankStatement>;
  findById(companyId: string, id: string): Promise<BankStatement | null>;
  list(companyId: string, accountId?: string): Promise<BankStatement[]>;
  updateLineMatch(
    companyId: string,
    statementId: string,
    lineId: string,
    matchStatus: BankStatementLine['matchStatus'],
    ledgerEntryId?: string
  ): Promise<void>;
}
