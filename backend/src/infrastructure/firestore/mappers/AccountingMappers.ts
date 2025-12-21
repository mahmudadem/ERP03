
/**
 * AccountingMappers.ts
 * 
 * Purpose:
 * Transforms Accounting Domain Entities to/from Firestore structure.
 */
import * as admin from 'firebase-admin';
import { Account } from '../../../domain/accounting/entities/Account';
import { Voucher } from '../../../domain/accounting/entities/Voucher';
import { VoucherLine } from '../../../domain/accounting/entities/VoucherLine';

const toTimestamp = (val?: any) => {
  if (!val) return admin.firestore.FieldValue.serverTimestamp();
  const date = val instanceof Date ? val : new Date(val);
  // In emulators Timestamp can be undefined; fall back to raw Date
  return (admin.firestore as any)?.Timestamp?.fromDate
    ? admin.firestore.Timestamp.fromDate(date)
    : date;
};

export class AccountMapper {
  static toDomain(data: any): Account {
    return new Account(
      data.companyId,
      data.id,
      data.code,
      data.name,
      data.type,
      data.currency,
      data.isProtected,
      data.active,
      data.parentId,
      data.createdAt?.toDate?.() || data.createdAt,
      data.updatedAt?.toDate?.() || data.updatedAt
    );
  }

  static toPersistence(entity: Account): any {
    return {
      companyId: entity.companyId,
      id: entity.id,
      code: entity.code,
      name: entity.name,
      type: entity.type,
      currency: entity.currency,
      isProtected: entity.isProtected,
      active: entity.active,
      parentId: entity.parentId || null,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt)
    };
  }
}

export class VoucherMapper {
  static toDomain(data: any): Voucher {
    const lines = (data.lines || []).map((l: any) => {
      const line = new VoucherLine(
        l.id,
        l.voucherId,
        l.accountId,
        l.description ?? null,
        l.fxAmount ?? 0,
        l.baseAmount ?? 0,
        l.rateAccToBase ?? 1,
        l.costCenterId
      );
      line.debitFx = l.debitFx;
      line.creditFx = l.creditFx;
      line.debitBase = l.debitBase ?? l.baseAmount;
      line.creditBase = l.creditBase;
      line.lineCurrency = l.lineCurrency;
      line.exchangeRate = l.exchangeRate ?? l.rateAccToBase;
      return line;
    });

    const voucher = new Voucher(
      data.id,
      data.companyId,
      data.type,
      data.date?.toDate?.() || data.date,
      data.currency,
      data.exchangeRate,
      data.status,
      data.totalDebit ?? data.totalDebitBase ?? 0,
      data.totalCredit ?? data.totalCreditBase ?? 0,
      data.createdBy,
      data.reference,
      lines
    );
    voucher.voucherNo = data.voucherNo;
    voucher.baseCurrency = data.baseCurrency || data.currency;
    voucher.totalDebitBase = data.totalDebitBase ?? data.totalDebit;
    voucher.totalCreditBase = data.totalCreditBase ?? data.totalCredit;
    voucher.createdAt = data.createdAt?.toDate?.() || data.createdAt;
    voucher.updatedAt = data.updatedAt?.toDate?.() || data.updatedAt;
    voucher.approvedBy = data.approvedBy;
    voucher.lockedBy = data.lockedBy;
    voucher.description = data.description ?? null;
    // Form metadata
    (voucher as any).formId = data.formId || null;
    (voucher as any).prefix = data.prefix || null;
    return voucher;
  }

  static toPersistence(entity: Voucher): any {
    const lines = entity.lines.map(l => ({
      id: l.id,
      voucherId: l.voucherId,
      accountId: l.accountId,
      description: l.description ?? null,
      fxAmount: l.fxAmount,
      baseAmount: l.baseAmount ?? l.debitBase ?? l.creditBase ?? 0,
      debitBase: l.debitBase,
      creditBase: l.creditBase,
      rateAccToBase: l.rateAccToBase ?? l.exchangeRate ?? 1,
      costCenterId: l.costCenterId || null,
      debitFx: l.debitFx,
      creditFx: l.creditFx,
      lineCurrency: l.lineCurrency,
      exchangeRate: l.exchangeRate
    }));

    return {
      id: entity.id,
      companyId: entity.companyId,
      type: entity.type,
      date: toTimestamp(entity.date),
      currency: entity.currency,
      exchangeRate: entity.exchangeRate,
      status: entity.status,
      totalDebit: entity.totalDebit ?? entity.totalDebitBase ?? 0,
      totalCredit: entity.totalCredit ?? entity.totalCreditBase ?? 0,
      totalDebitBase: entity.totalDebitBase ?? entity.totalDebit ?? 0,
      totalCreditBase: entity.totalCreditBase ?? entity.totalCredit ?? 0,
      voucherNo: entity.voucherNo,
      baseCurrency: entity.baseCurrency,
      createdBy: entity.createdBy,
      approvedBy: entity.approvedBy || null,
      lockedBy: entity.lockedBy || null,
      reference: entity.reference || null,
      description: entity.description ?? null,
      // Form metadata
      formId: (entity as any).formId || null,
      prefix: (entity as any).prefix || null,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      lines: lines
    };
  }
}
