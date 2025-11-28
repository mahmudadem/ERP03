/**
 * AccountingMappers.ts
 * 
 * Purpose:
 * Transforms Accounting Domain Entities to/from Firestore structure.
 */
import * as admin from 'firebase-admin';
import { Account } from '../../../domain/accounting/entities/Account';
import { Voucher } from '../../../domain/accounting/entities/Voucher';

export class AccountMapper {
  static toDomain(data: any): Account {
    return new Account(
      data.id,
      data.code,
      data.name,
      data.type,
      data.currency,
      data.isProtected,
      data.active,
      data.parentId
    );
  }

  static toPersistence(entity: Account): any {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      type: entity.type,
      currency: entity.currency,
      isProtected: entity.isProtected,
      active: entity.active,
      parentId: entity.parentId || null
    };
  }
}

export class VoucherMapper {
  static toDomain(data: any): Voucher {
    return new Voucher(
      data.id,
      data.companyId,
      data.type,
      data.date?.toDate?.() || new Date(data.date),
      data.currency,
      data.exchangeRate,
      data.status,
      data.totalDebit,
      data.totalCredit,
      data.createdBy,
      data.reference
    );
  }

  static toPersistence(entity: Voucher): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      type: entity.type,
      date: admin.firestore.Timestamp.fromDate(entity.date),
      currency: entity.currency,
      exchangeRate: entity.exchangeRate,
      status: entity.status,
      totalDebit: entity.totalDebit,
      totalCredit: entity.totalCredit,
      createdBy: entity.createdBy,
      reference: entity.reference || null
    };
  }
}