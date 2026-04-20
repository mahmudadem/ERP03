/**
 * PrismaAccountRepository
 *
 * SQL implementation of IAccountRepository using Prisma.
 * Handles Chart of Accounts operations including system code generation,
 * USED detection, hierarchy management, and audit event recording.
 */

import { PrismaClient } from '@prisma/client';
import { IAccountRepository, CashFlowCategory, PlSubgroup, EquitySubgroup } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { Account, AccountClassification, AccountRole, AccountStatus, BalanceNature, BalanceEnforcement, CurrencyPolicy } from '../../../../domain/accounting/models/Account';

export class PrismaAccountRepository implements IAccountRepository {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private toDomain(record: any): Account {
    const account = new Account({
      id: record.id,
      systemCode: record.systemCode,
      companyId: record.companyId,
      userCode: record.userCode,
      name: record.name,
      description: record.description ?? null,
      accountRole: record.accountRole as AccountRole,
      classification: record.classification as AccountClassification,
      balanceNature: record.balanceNature as BalanceNature,
      balanceEnforcement: record.balanceEnforcement as BalanceEnforcement,
      parentId: record.parentId ?? null,
      currencyPolicy: record.currencyPolicy as CurrencyPolicy,
      fixedCurrencyCode: record.fixedCurrencyCode ?? null,
      allowedCurrencyCodes: record.allowedCurrencyCodes ?? [],
      status: record.status as AccountStatus,
      isProtected: record.isProtected ?? false,
      replacedByAccountId: record.replacedByAccountId ?? null,
      cashFlowCategory: record.cashFlowCategory as CashFlowCategory | null,
      plSubgroup: record.plSubgroup as PlSubgroup | null,
      equitySubgroup: record.equitySubgroup as EquitySubgroup | null,
      createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt),
      createdBy: record.createdBy ?? 'SYSTEM',
      updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
      updatedBy: record.updatedBy ?? 'SYSTEM',
      requiresApproval: record.requiresApproval ?? false,
      requiresCustodyConfirmation: record.requiresCustodyConfirmation ?? false,
      custodianUserId: record.custodianUserId ?? null,
    });

    if (record._count?.children) {
      account.setHasChildren(record._count.children > 0);
    }

    return account;
  }

  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  async list(companyId: string): Promise<Account[]> {
    const records = await this.prisma.account.findMany({
      where: { companyId },
      orderBy: { systemCode: 'asc' },
      include: { _count: { select: { children: true } } },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(companyId: string, accountId: string, transaction?: any): Promise<Account | null> {
    const tx = transaction || this.prisma;
    const record = await tx.account.findFirst({
      where: { id: accountId, companyId },
      include: { _count: { select: { children: true } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async getByUserCode(companyId: string, userCode: string): Promise<Account | null> {
    const record = await this.prisma.account.findFirst({
      where: { companyId, userCode },
      include: { _count: { select: { children: true } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async getByCode(companyId: string, code: string): Promise<Account | null> {
    return this.getByUserCode(companyId, code);
  }

  async getAccounts(companyId: string): Promise<Account[]> {
    return this.list(companyId);
  }

  // =========================================================================
  // MUTATION METHODS
  // =========================================================================

  async create(companyId: string, data: any): Promise<Account> {
    const systemCode = await this.generateNextSystemCode(companyId);
    const userCode = data.userCode || data.code || '';
    const classification = (data.classification || data.type || 'ASSET') as AccountClassification;
    const balanceNature = data.balanceNature || this.getDefaultBalanceNature(classification);
    const accountRole = data.accountRole || 'POSTING';
    const balanceEnforcement = data.balanceEnforcement || 'WARN_ABNORMAL';
    const currencyPolicy = data.currencyPolicy || 'INHERIT';
    const fixedCurrencyCode = data.fixedCurrencyCode || data.currency || null;
    const allowedCurrencyCodes = data.allowedCurrencyCodes || [];
    const isProtected = data.isProtected ?? false;
    const parentId = data.parentId || null;
    const cashFlowCategory = data.cashFlowCategory || null;
    const plSubgroup = data.plSubgroup || null;
    const equitySubgroup = data.equitySubgroup || null;
    const requiresApproval = data.requiresApproval ?? false;
    const requiresCustodyConfirmation = data.requiresCustodyConfirmation ?? false;
    const custodianUserId = data.custodianUserId || null;
    const description = data.description || null;
    const createdBy = data.createdBy || 'SYSTEM';

    const record = await this.prisma.account.create({
      data: {
        id: data.id || crypto.randomUUID(),
        company: { connect: { id: companyId } },
        systemCode,
        userCode,
        name: data.name,
        description,
        accountRole,
        classification,
        balanceNature,
        balanceEnforcement,
        parentId,
        currencyPolicy,
        fixedCurrencyCode,
        allowedCurrencyCodes,
        status: 'ACTIVE',
        isProtected,
        replacedByAccountId: null,
        cashFlowCategory,
        plSubgroup,
        equitySubgroup,
        requiresApproval,
        requiresCustodyConfirmation,
        custodianUserId,
        createdBy,
        updatedBy: createdBy,
      } as any,
    });

    return this.toDomain(record);
  }

  async update(companyId: string, accountId: string, data: any): Promise<Account> {
    const updateData: any = {};

    if (data.userCode !== undefined || data.code !== undefined) {
      updateData.userCode = data.userCode || data.code;
    }
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.replacedByAccountId !== undefined) {
      updateData.replacedByAccountId = data.replacedByAccountId;
    }
    if (data.accountRole !== undefined) {
      updateData.accountRole = data.accountRole;
    }
    if (data.classification !== undefined || data.type !== undefined) {
      updateData.classification = data.classification || data.type;
    }
    if (data.balanceNature !== undefined) {
      updateData.balanceNature = data.balanceNature;
    }
    if (data.balanceEnforcement !== undefined) {
      updateData.balanceEnforcement = data.balanceEnforcement;
    }
    if (data.currencyPolicy !== undefined) {
      updateData.currencyPolicy = data.currencyPolicy;
    }
    if (data.fixedCurrencyCode !== undefined || data.currency !== undefined) {
      updateData.fixedCurrencyCode = data.fixedCurrencyCode || data.currency;
    }
    if (data.allowedCurrencyCodes !== undefined) {
      updateData.allowedCurrencyCodes = data.allowedCurrencyCodes;
    }
    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId;
    }
    if (data.isProtected !== undefined) {
      updateData.isProtected = data.isProtected;
    }
    if (data.cashFlowCategory !== undefined) {
      updateData.cashFlowCategory = data.cashFlowCategory;
    }
    if (data.plSubgroup !== undefined) {
      updateData.plSubgroup = data.plSubgroup;
    }
    if (data.equitySubgroup !== undefined) {
      updateData.equitySubgroup = data.equitySubgroup;
    }
    if (data.requiresApproval !== undefined) {
      updateData.requiresApproval = data.requiresApproval;
    }
    if (data.requiresCustodyConfirmation !== undefined) {
      updateData.requiresCustodyConfirmation = data.requiresCustodyConfirmation;
    }
    if (data.custodianUserId !== undefined) {
      updateData.custodianUserId = data.custodianUserId;
    }

    updateData.updatedBy = data.updatedBy || 'SYSTEM';

    const record = await this.prisma.account.update({
      where: { id: accountId, companyId },
      data: updateData,
      include: { _count: { select: { children: true } } },
    });

    return this.toDomain(record);
  }

  async delete(companyId: string, accountId: string): Promise<void> {
    await this.prisma.account.delete({
      where: { id: accountId, companyId },
    });
  }

  async deactivate(companyId: string, accountId: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId, companyId },
      data: { status: 'INACTIVE', updatedBy: 'SYSTEM' },
    });
  }

  // =========================================================================
  // VALIDATION/CHECK METHODS
  // =========================================================================

  async isUsed(companyId: string, accountId: string): Promise<boolean> {
    const [ledgerCount, voucherLineCount] = await Promise.all([
      this.prisma.ledgerEntry.count({
        where: { companyId, accountId },
      }),
      this.prisma.voucherLine.count({
        where: { accountId },
      }),
    ]);
    return ledgerCount > 0 || voucherLineCount > 0;
  }

  async hasChildren(companyId: string, accountId: string): Promise<boolean> {
    const count = await this.prisma.account.count({
      where: { companyId, parentId: accountId },
    });
    return count > 0;
  }

  async countChildren(companyId: string, accountId: string): Promise<number> {
    return this.prisma.account.count({
      where: { companyId, parentId: accountId },
    });
  }

  async existsByUserCode(companyId: string, userCode: string, excludeAccountId?: string): Promise<boolean> {
    const where: any = { companyId, userCode };
    if (excludeAccountId) {
      where.id = { not: excludeAccountId };
    }
    const count = await this.prisma.account.count({ where });
    return count > 0;
  }

  async generateNextSystemCode(companyId: string): Promise<string> {
    const counter = await this.prisma.account.count({
      where: { companyId },
    });
    const nextNumber = counter + 1;
    return `ACC-${String(nextNumber).padStart(6, '0')}`;
  }

  async countByCurrency(companyId: string, currencyCode: string): Promise<number> {
    return this.prisma.account.count({
      where: {
        companyId,
        fixedCurrencyCode: currencyCode.toUpperCase(),
      },
    });
  }

  // =========================================================================
  // AUDIT METHODS
  // =========================================================================

  async recordAuditEvent(
    companyId: string,
    accountId: string,
    event: {
      type: 'NAME_CHANGED' | 'USER_CODE_CHANGED' | 'STATUS_CHANGED' | 'REPLACED_BY_CHANGED' | 'CURRENCY_POLICY_CHANGED' | 'OTHER';
      field: string;
      oldValue: any;
      newValue: any;
      changedBy: string;
      changedAt: Date;
    }
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        company: { connect: { id: companyId } },
        entityType: 'Account',
        entityId: accountId,
        action: event.type,
        fieldName: event.field,
        oldValue: event.oldValue as any,
        newValue: event.newValue as any,
        performedBy: event.changedBy,
        performedAt: event.changedAt,
      } as any,
    });
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private getDefaultBalanceNature(classification: AccountClassification): BalanceNature {
    switch (classification) {
      case 'ASSET':
      case 'EXPENSE':
        return 'DEBIT';
      case 'LIABILITY':
      case 'EQUITY':
      case 'REVENUE':
        return 'CREDIT';
      default:
        return 'DEBIT';
    }
  }
}
