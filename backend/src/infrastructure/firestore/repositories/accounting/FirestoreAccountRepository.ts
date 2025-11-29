/**
 * FirestoreAccountRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of IAccountRepository for the Chart of Accounts.
 */
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting';
import { Account } from '../../../../domain/accounting/entities/Account';
import { AccountMapper } from '../../mappers/AccountingMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreAccountRepository extends BaseFirestoreRepository<Account> implements IAccountRepository {
  protected collectionName = 'accounts';

  protected toDomain(data: any): Account {
    return AccountMapper.toDomain(data);
  }

  protected toPersistence(entity: Account): any {
    return AccountMapper.toPersistence(entity);
  }

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection(this.collectionName);
  }

  async createAccount(account: Account, companyId?: string): Promise<void> {
    try {
      const cid = companyId || (account as any).companyId;
      if (!cid) throw new Error('companyId required');
      await this.col(cid).doc(account.id).set(this.toPersistence({ ...account, companyId: cid } as any));
    } catch (error) {
      throw new InfrastructureError('Error creating account', error);
    }
  }

  async updateAccount(id: string, data: Partial<Account>, companyId?: string): Promise<void> {
    try {
      if (!companyId) throw new Error('companyId required');
      await this.col(companyId).doc(id).update(data);
    } catch (error) {
      throw new InfrastructureError('Error updating account', error);
    }
  }

  async deactivateAccount(id: string, companyId?: string): Promise<void> {
    try {
      if (!companyId) throw new Error('companyId required');
      const children = await this.col(companyId).where('parentId', '==', id).get();
      if (!children.empty) throw new Error('Cannot deactivate account with children');
      await this.col(companyId).doc(id).update({ active: false });
    } catch (error) {
      throw new InfrastructureError('Error deactivating account', error);
    }
  }

  async getAccount(id: string, companyId?: string): Promise<Account | null> {
    if (!companyId) return null;
    const doc = await this.col(companyId).doc(id).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.data());
  }

  async getAccounts(companyId: string): Promise<Account[]> {
    try {
      const snapshot = await this.col(companyId).get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error fetching accounts', error);
    }
  }

  async getByCode(companyId: string, code: string): Promise<Account | null> {
    try {
      const snap = await this.col(companyId).where('code', '==', code).limit(1).get();
      if (snap.empty) return null;
      return this.toDomain(snap.docs[0].data());
    } catch (error) {
      throw new InfrastructureError('Error getting account by code', error);
    }
  }
}
