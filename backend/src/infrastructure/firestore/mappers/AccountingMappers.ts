
/**
 * AccountingMappers.ts
 * 
 * Purpose:
 * Transforms Accounting Domain Entities to/from Firestore structure.
 * 
 * V2 ONLY - Legacy Voucher/VoucherLine classes have been removed.
 * VoucherEntity now uses built-in toJSON()/fromJSON() for persistence.
 */
import * as admin from 'firebase-admin';
import { Account } from '../../../domain/accounting/entities/Account';

/**
 * Safely convert any date value to Firestore-compatible format.
 * Handles: Date objects, ISO strings, timestamps, or null/undefined.
 */
const toFirestoreDate = (val?: any): any => {
  if (val === null || val === undefined) {
    return admin.firestore.FieldValue.serverTimestamp();
  }
  
  const TimestampClass = admin.firestore?.Timestamp;
  
  if (TimestampClass && val instanceof TimestampClass) {
    return val;
  }
  
  if (val instanceof Date) {
    try {
      if (TimestampClass?.fromDate) {
        return TimestampClass.fromDate(val);
      }
      return val.toISOString();
    } catch {
      return val.toISOString();
    }
  }
  
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    
    try {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        if (TimestampClass?.fromDate) {
          return TimestampClass.fromDate(date);
        }
        return date.toISOString();
      }
    } catch {
      // Ignore
    }
    return val;
  }
  
  if (typeof val === 'number') {
    try {
      if (TimestampClass?.fromMillis) {
        return TimestampClass.fromMillis(val);
      }
      return new Date(val).toISOString();
    } catch {
      return val;
    }
  }
  
  return val;
};

/**
 * Account Mapper
 * Used for converting Account entities to/from Firestore
 */
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
      createdAt: toFirestoreDate(entity.createdAt),
      updatedAt: toFirestoreDate(entity.updatedAt)
    };
  }
}

/**
 * VoucherMapper - DEPRECATED
 * 
 * VoucherEntity V2 now uses built-in toJSON() and fromJSON() methods.
 * The FirestoreVoucherRepositoryV2 uses these directly.
 * 
 * This class is kept for backwards compatibility with any remaining
 * code that might reference it, but should not be used for new code.
 */
export class VoucherMapper {
  /**
   * @deprecated Use VoucherEntity.fromJSON() directly
   */
  static toDomain(data: any): any {
    // Import dynamically to avoid circular deps in case of removal
    const { VoucherEntity } = require('../../../domain/accounting/entities/VoucherEntity');
    return VoucherEntity.fromJSON(data);
  }

  /**
   * @deprecated Use voucher.toJSON() directly
   */
  static toPersistence(entity: any): any {
    if (typeof entity.toJSON === 'function') {
      return entity.toJSON();
    }
    // Fallback for any edge cases
    return entity;
  }
}
