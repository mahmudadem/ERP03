/**
 * FirestoreAccountRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of IAccountRepository for the Chart of Accounts.
 */
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IAccountRepository, NewAccountInput, UpdateAccountInput } from '../../../../repository/interfaces/accounting';
import { Account, AccountType } from '../../../../domain/accounting/entities/Account';
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

  async create(companyId: string, data: NewAccountInput): Promise<Account> {
    try {
      const accountId = this.db.collection('tmp').doc().id;
      const account = new Account(
        companyId,
        accountId,
        data.code,
        data.name,
        data.type as AccountType,
        data.currency || '',
        (data as any).isProtected ?? false,
        (data as any).isActive ?? true,
        data.parentId || undefined,
        new Date(),
        new Date()
      );
      await this.col(companyId).doc(account.id).set(this.toPersistence({ ...account, companyId } as any));
      return account;
    } catch (error) {
      throw new InfrastructureError('Error creating account', error);
    }
  }

  async update(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account> {
    try {
      await this.col(companyId).doc(accountId).update(data as any);
      const doc = await this.col(companyId).doc(accountId).get();
      return this.toDomain(doc.data());
    } catch (error) {
      throw new InfrastructureError('Error updating account', error);
    }
  }

  async deactivate(companyId: string, accountId: string): Promise<void> {
    try {
      const children = await this.col(companyId).where('parentId', '==', accountId).get();
      if (!children.empty) throw new Error('Cannot deactivate account with children');
      await this.col(companyId).doc(accountId).update({ active: false });
    } catch (error) {
      throw new InfrastructureError('Error deactivating account', error);
    }
  }

  async getById(companyId: string, accountId: string): Promise<Account | null> {
    const doc = await this.col(companyId).doc(accountId).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.data());
  }

  async list(companyId: string): Promise<Account[]> {
    try {
      const snapshot = await this.col(companyId).get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error fetching accounts', error);
    }
  }

  async getAccounts(companyId: string): Promise<Account[]> {
    return this.list(companyId);
  }

  async hasChildren(companyId: string, accountId: string): Promise<boolean> {
    const snapshot = await this.col(companyId).where('parentId', '==', accountId).limit(1).get();
    return !snapshot.empty;
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
