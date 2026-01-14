/**
 * AccountingMappers.ts
 * 
 * Transforms Accounting Domain Entities to/from Firestore structure.
 * Handles legacy field mapping (type->classification, code->userCode, etc.)
 */

import * as admin from 'firebase-admin';
import { 
  Account, 
  normalizeClassification, 
  getDefaultBalanceNature 
} from '../../../domain/accounting/entities/Account';

/**
 * Safely convert any date value to Firestore-compatible format.
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
 * Convert Firestore timestamp to Date
 */
const fromFirestoreDate = (val?: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string') return new Date(val);
  if (typeof val === 'number') return new Date(val);
  return new Date();
};

/**
 * Account Mapper
 * Handles bidirectional mapping between Account entity and Firestore
 */
export class AccountMapper {
  /**
   * Convert Firestore data to Account entity
   * Handles legacy field names for backward compatibility
   */
  static toDomain(data: any): Account {
    // Handle legacy field mapping
    const classification = normalizeClassification(
      data.classification || data.type || 'ASSET'
    );
    
    return Account.fromJSON({
      id: data.id,
      systemCode: data.systemCode || data.code || data.id,
      companyId: data.companyId,
      userCode: data.userCode || data.code || data.id,
      name: data.name,
      description: data.description || null,
      
      // Accounting semantics with defaults
      accountRole: data.accountRole || (data.isParent || data.hasChildren ? 'HEADER' : 'POSTING'),
      classification,
      balanceNature: data.balanceNature || getDefaultBalanceNature(classification),
      balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
      
      // Hierarchy
      parentId: data.parentId || null,
      
      // Currency
      currencyPolicy: data.currencyPolicy || 'INHERIT',
      fixedCurrencyCode: data.fixedCurrencyCode || data.currency || null,
      allowedCurrencyCodes: data.allowedCurrencyCodes || [],
      
      // Lifecycle
      status: data.status || (data.active === false ? 'INACTIVE' : 'ACTIVE'),
      isProtected: data.isProtected ?? false,
      replacedByAccountId: data.replacedByAccountId || null,
      
      // Audit
      createdAt: fromFirestoreDate(data.createdAt),
      createdBy: data.createdBy || 'SYSTEM',
      updatedAt: fromFirestoreDate(data.updatedAt),
      updatedBy: data.updatedBy || 'SYSTEM',
      
      // Legacy compat
      requiresApproval: data.requiresApproval || false,
      requiresCustodyConfirmation: data.requiresCustodyConfirmation || false,
      custodianUserId: data.custodianUserId || null
    });
  }

  /**
   * Convert Account entity to Firestore persistence format
   */
  static toPersistence(entity: Account): any {
    return {
      id: entity.id,
      systemCode: entity.systemCode,
      companyId: entity.companyId,
      userCode: entity.userCode,
      name: entity.name,
      description: entity.description,
      
      // Accounting semantics
      accountRole: entity.accountRole,
      classification: entity.classification,
      balanceNature: entity.balanceNature,
      balanceEnforcement: entity.balanceEnforcement,
      
      // Hierarchy
      parentId: entity.parentId,
      
      // Currency
      currencyPolicy: entity.currencyPolicy,
      fixedCurrencyCode: entity.fixedCurrencyCode,
      allowedCurrencyCodes: entity.allowedCurrencyCodes,
      
      // Lifecycle
      status: entity.status,
      isProtected: entity.isProtected,
      replacedByAccountId: entity.replacedByAccountId,
      
      // Audit
      createdAt: toFirestoreDate(entity.createdAt),
      createdBy: entity.createdBy,
      updatedAt: toFirestoreDate(entity.updatedAt),
      updatedBy: entity.updatedBy,
      
      // Legacy compat (for any code still reading these)
      code: entity.userCode,
      type: entity.classification,
      currency: entity.fixedCurrencyCode || '',
      active: entity.status === 'ACTIVE',
      
      // Approval policy
      requiresApproval: entity.requiresApproval,
      requiresCustodyConfirmation: entity.requiresCustodyConfirmation,
      custodianUserId: entity.custodianUserId
    };
  }
}

/**
 * VoucherMapper - DEPRECATED
 * 
 * VoucherEntity V2 now uses built-in toJSON() and fromJSON() methods.
 */
export class VoucherMapper {
  /**
   * @deprecated Use VoucherEntity.fromJSON() directly
   */
  static toDomain(data: any): any {
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
    return entity;
  }
}
