/**
 * PrismaBankStatementRepository
 *
 * SQL implementation of IBankStatementRepository using Prisma.
 * Handles bank statement storage, retrieval, and line match status updates.
 */

import { PrismaClient } from '@prisma/client';
import { IBankStatementRepository } from '../../../../repository/interfaces/accounting/IBankStatementRepository';
import { BankStatement, BankStatementLine, BankStatementMatchStatus } from '../../../../domain/accounting/entities/BankStatement';

export class PrismaBankStatementRepository implements IBankStatementRepository {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private toDomain(record: any): BankStatement {
    const lines: BankStatementLine[] = (record.lines as any[]) ?? [];

    return new BankStatement(
      record.id,
      record.companyId,
      record.accountNo,
      record.accountName ?? '',
      record.statementDate instanceof Date
        ? record.statementDate.toISOString().split('T')[0]
        : String(record.statementDate).split('T')[0],
      record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt),
      record.importedBy ?? 'SYSTEM',
      lines
    );
  }

  private toPrismaLines(lines: BankStatementLine[]): any {
    return lines.map((line) => ({
      id: line.id,
      date: line.date,
      description: line.description,
      reference: line.reference ?? null,
      amount: line.amount,
      balance: line.balance ?? null,
      matchedLedgerEntryId: line.matchedLedgerEntryId ?? null,
      matchStatus: line.matchStatus,
    }));
  }

  // =========================================================================
  // IMPLEMENTATION
  // =========================================================================

  async save(statement: BankStatement): Promise<BankStatement> {
    const existing = await this.prisma.bankStatement.findUnique({
      where: { id: statement.id },
    });

    if (existing) {
      const record = await this.prisma.bankStatement.update({
        where: { id: statement.id },
        data: {
          accountNo: statement.accountId,
          accountName: statement.bankName,
          statementDate: new Date(statement.statementDate),
          lines: this.toPrismaLines(statement.lines) as any,
          closingBalance: statement.lines.length > 0
            ? statement.lines[statement.lines.length - 1].balance ?? 0
            : 0,
        } as any,
      });
      return this.toDomain(record);
    }

    const record = await this.prisma.bankStatement.create({
      data: {
        id: statement.id,
        company: { connect: { id: statement.companyId } },
        accountNo: statement.accountId,
        accountName: statement.bankName,
        statementDate: new Date(statement.statementDate),
        openingBalance: 0,
        closingBalance: statement.lines.length > 0
          ? statement.lines[statement.lines.length - 1].balance ?? 0
          : 0,
        currency: 'USD',
        lines: this.toPrismaLines(statement.lines) as any,
        status: 'IMPORTED',
      } as any,
    });

    return this.toDomain(record);
  }

  async findById(companyId: string, id: string): Promise<BankStatement | null> {
    const record = await this.prisma.bankStatement.findFirst({
      where: { id, companyId },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(companyId: string, accountId?: string): Promise<BankStatement[]> {
    const where: any = { companyId };
    if (accountId) {
      where.accountNo = accountId;
    }

    const records = await this.prisma.bankStatement.findMany({
      where,
      orderBy: { statementDate: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async updateLineMatch(
    companyId: string,
    statementId: string,
    lineId: string,
    matchStatus: BankStatementMatchStatus,
    ledgerEntryId?: string
  ): Promise<void> {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });

    if (!statement) {
      throw new Error(`BankStatement not found: ${statementId}`);
    }

    const lines: any[] = (statement.lines as any[]) ?? [];
    const lineIndex = lines.findIndex((l: any) => l.id === lineId);

    if (lineIndex === -1) {
      throw new Error(`BankStatementLine not found: ${lineId}`);
    }

    lines[lineIndex] = {
      ...lines[lineIndex],
      matchStatus,
      matchedLedgerEntryId: ledgerEntryId ?? null,
    };

    await this.prisma.bankStatement.update({
      where: { id: statementId },
      data: { lines: lines as any } as any,
    });
  }
}
