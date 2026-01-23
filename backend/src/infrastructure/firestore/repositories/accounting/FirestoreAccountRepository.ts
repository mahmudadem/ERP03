/**
 * FirestoreAccountRepository
 * 
 * Firestore implementation of IAccountRepository.
 * Implements: USED detection, system code generation, audit events.
 */

import { IAccountRepository, NewAccountInput, UpdateAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { 
  Account, 
  normalizeUserCode, 
  normalizeClassification, 
  getDefaultBalanceNature 
} from '../../../../domain/accounting/entities/Account';
import { InfrastructureError } from '../../../errors/InfrastructureError';
import * as admin from 'firebase-admin';
import { Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export class FirestoreAccountRepository implements IAccountRepository {
  protected db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  protected toDomain(data: any): Account {
    return Account.fromJSON(data);
  }

  protected toPersistence(entity: Account): any {
    return entity.toJSON();
  }

  private collectionName = 'accounts';

  private col(companyId: string) {
    // MODULAR PATTERN: companies/{id}/accounting (coll) -> Data (doc) -> accounts (coll)
    return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection(this.collectionName);
  }

  private voucherLinesCol(companyId: string) {
    // VoucherLines are stored under vouchers in Firestore
    return this.db.collectionGroup('lines');
  }

  private countersDoc(companyId: string) {
    // MODULAR PATTERN: companies/{id}/accounting (coll) -> Data (doc) -> counters (coll) -> accountSystemCode (doc)
    return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('counters').doc('accountSystemCode');
  }

  private auditEventsCol(companyId: string, accountId: string) {
    return this.col(companyId).doc(accountId).collection('events');
  }

  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  async getById(companyId: string, accountId: string, transaction?: admin.firestore.Transaction): Promise<Account | null> {
    try {
      let doc;
      if (transaction) {
        doc = await transaction.get(this.col(companyId).doc(accountId));
      } else {
        doc = await this.col(companyId).doc(accountId).get();
      }
      if (!doc.exists) return null;
      const account = this.toDomain({ ...doc.data(), id: doc.id });
      
      const hasChildren = await this.hasChildren(companyId, accountId);
      account.setHasChildren(hasChildren);
      
      return account;
    } catch (error) {
      throw new InfrastructureError('Error getting account by ID', error);
    }
  }

  async getByUserCode(companyId: string, userCode: string): Promise<Account | null> {
    try {
      const normalized = normalizeUserCode(userCode);
      const snap = await this.col(companyId).where('userCode', '==', normalized).limit(1).get();
      
      if (snap.empty) {
        const legacySnap = await this.col(companyId).where('code', '==', userCode).limit(1).get();
        if (legacySnap.empty) return null;
        return this.toDomain({ ...legacySnap.docs[0].data(), id: legacySnap.docs[0].id });
      }
      return this.toDomain({ ...snap.docs[0].data(), id: snap.docs[0].id });
    } catch (error) {
      throw new InfrastructureError('Error getting account by user code', error);
    }
  }

  async getByCode(companyId: string, code: string): Promise<Account | null> {
    return this.getByUserCode(companyId, code);
  }

  async list(companyId: string): Promise<Account[]> {
    try {
      const snapshot = await this.col(companyId).get();
      const accounts = snapshot.docs.map(doc => this.toDomain({ ...doc.data(), id: doc.id }));
      
      const parentIds = new Set(accounts.map(a => a.parentId).filter(Boolean));
      accounts.forEach(a => a.setHasChildren(parentIds.has(a.id)));
      
      return accounts;
    } catch (error) {
      throw new InfrastructureError('Error listing accounts', error);
    }
  }

  async getAccounts(companyId: string): Promise<Account[]> {
    return this.list(companyId);
  }

  // =========================================================================
  // MUTATION METHODS
  // =========================================================================

  async create(companyId: string, data: NewAccountInput): Promise<Account> {
    try {
      const id = data.id || this.db.collection('tmp').doc().id;
      const systemCode = await this.generateNextSystemCode(companyId);
      
      const userCode = normalizeUserCode(data.userCode || data.code || '');
      const classification = normalizeClassification(data.classification || data.type || 'ASSET');
      const balanceNature = data.balanceNature || getDefaultBalanceNature(classification);
      
      const now = new Date();
      
      const account = new Account({
        id,
        systemCode,
        companyId,
        userCode,
        name: data.name,
        description: data.description ?? null,
        accountRole: data.accountRole || 'POSTING',
        classification,
        balanceNature,
        balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
        parentId: data.parentId ?? null,
        currencyPolicy: data.currencyPolicy || 'INHERIT',
        fixedCurrencyCode: data.fixedCurrencyCode || data.currency || null,
        allowedCurrencyCodes: data.allowedCurrencyCodes || [],
        status: 'ACTIVE',
        isProtected: data.isProtected ?? false,
        replacedByAccountId: null,
        createdAt: now,
        createdBy: data.createdBy,
        updatedAt: now,
        updatedBy: data.createdBy,
        requiresApproval: data.requiresApproval || false,
        requiresCustodyConfirmation: data.requiresCustodyConfirmation || false,
        custodianUserId: data.custodianUserId ?? null
      });
      
      const errors = account.validate();
      if (errors.length > 0) {
        throw new Error(`Account validation failed: ${errors.join('; ')}`);
      }
      
      await this.col(companyId).doc(id).set(this.toPersistence(account));
      return account;
    } catch (error) {
      throw new InfrastructureError('Error creating account', error);
    }
  }

  async update(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account> {
    try {
      const docRef = this.col(companyId).doc(accountId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error('Account not found');
      }
      
      const existing = this.toDomain({ ...doc.data(), id: doc.id });
      const now = new Date();
      
      const updateData: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: data.updatedBy
      };
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.userCode !== undefined) updateData.userCode = normalizeUserCode(data.userCode || data.code || '');
      if (data.status !== undefined) updateData.status = data.status;
      if (data.isActive !== undefined) updateData.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
      if (data.replacedByAccountId !== undefined) {
        updateData.replacedByAccountId = data.replacedByAccountId;
        if (data.replacedByAccountId) {
          updateData.status = 'INACTIVE';
        }
      }
      if (data.parentId !== undefined) updateData.parentId = data.parentId;
      if (data.isProtected !== undefined) updateData.isProtected = data.isProtected;
      
      if (data.accountRole !== undefined) updateData.accountRole = data.accountRole;
      if (data.classification !== undefined) updateData.classification = normalizeClassification(data.classification || data.type || existing.classification);
      if (data.balanceNature !== undefined) updateData.balanceNature = data.balanceNature;
      if (data.balanceEnforcement !== undefined) updateData.balanceEnforcement = data.balanceEnforcement;
      if (data.currencyPolicy !== undefined) updateData.currencyPolicy = data.currencyPolicy;
      if (data.fixedCurrencyCode !== undefined) updateData.fixedCurrencyCode = data.fixedCurrencyCode || data.currency || null;
      if (data.allowedCurrencyCodes !== undefined) updateData.allowedCurrencyCodes = data.allowedCurrencyCodes;
      
      if (data.requiresApproval !== undefined) updateData.requiresApproval = data.requiresApproval;
      if (data.requiresCustodyConfirmation !== undefined) updateData.requiresCustodyConfirmation = data.requiresCustodyConfirmation;
      if (data.custodianUserId !== undefined) updateData.custodianUserId = data.custodianUserId;
      
      await docRef.update(updateData);
      
      const updatedDoc = await docRef.get();
      return this.toDomain({ ...updatedDoc.data(), id: updatedDoc.id });
    } catch (error) {
      throw new InfrastructureError('Error updating account', error);
    }
  }

  async delete(companyId: string, accountId: string): Promise<void> {
    try {
      await this.col(companyId).doc(accountId).delete();
    } catch (error) {
      throw new InfrastructureError('Error deleting account', error);
    }
  }

  async deactivate(companyId: string, accountId: string): Promise<void> {
    try {
      await this.col(companyId).doc(accountId).update({ 
        status: 'INACTIVE',
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      throw new InfrastructureError('Error deactivating account', error);
    }
  }

  // =========================================================================
  // VALIDATION/CHECK METHODS
  // =========================================================================

  async isUsed(companyId: string, accountId: string): Promise<boolean> {
    try {
      const vouchersCol = this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('vouchers');
      const vouchersSnap = await vouchersCol.limit(1).get();
      
      if (vouchersSnap.empty) {
        return false;
      }
      
      const allVouchers = await vouchersCol.get();
      
      for (const voucherDoc of allVouchers.docs) {
        const linesSnap = await voucherDoc.ref.collection('lines').where('accountId', '==', accountId).limit(1).get();
        if (!linesSnap.empty) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking if account is used:', error);
      return false;
    }
  }

  async hasChildren(companyId: string, accountId: string): Promise<boolean> {
    const count = await this.countChildren(companyId, accountId);
    return count > 0;
  }

  async countChildren(companyId: string, accountId: string): Promise<number> {
    try {
      const snapshot = await this.col(companyId).where('parentId', '==', accountId).count().get();
      return snapshot.data().count;
    } catch (error) {
      throw new InfrastructureError('Error counting account children', error);
    }
  }

  async existsByUserCode(companyId: string, userCode: string, excludeAccountId?: string): Promise<boolean> {
    try {
      const normalized = normalizeUserCode(userCode);
      const snap = await this.col(companyId).where('userCode', '==', normalized).get();
      
      if (snap.empty) return false;
      
      if (excludeAccountId) {
        return snap.docs.some(doc => doc.id !== excludeAccountId);
      }
      
      return true;
    } catch (error) {
      throw new InfrastructureError('Error checking user code existence', error);
    }
  }

  async generateNextSystemCode(companyId: string): Promise<string> {
    try {
      const counterRef = this.countersDoc(companyId);
      
      const newCode = await this.db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let nextNumber = 1;
        if (counterDoc.exists) {
          nextNumber = (counterDoc.data()?.value || 0) + 1;
        }
        
        transaction.set(counterRef, { value: nextNumber }, { merge: true });
        
        return `ACC-${String(nextNumber).padStart(6, '0')}`;
      });
      
      return newCode;
    } catch (error) {
      throw new InfrastructureError('Error generating system code', error);
    }
  }

  async countByCurrency(companyId: string, currencyCode: string): Promise<number> {
    try {
      const snapshot = await this.col(companyId)
        .where('fixedCurrencyCode', '==', currencyCode.toUpperCase())
        .count()
        .get();
      return snapshot.data().count;
    } catch (error) {
      throw new InfrastructureError('Error counting accounts by currency', error);
    }
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
    try {
      const eventId = this.db.collection('tmp').doc().id;
      await this.auditEventsCol(companyId, accountId).doc(eventId).set({
        ...event,
        changedAt: Timestamp.fromDate(event.changedAt)
      });
    } catch (error) {
      // Audit failures should not block operations
      console.error('Error recording audit event:', error);
    }
  }
}
