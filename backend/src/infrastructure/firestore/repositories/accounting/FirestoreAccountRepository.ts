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

  async createAccount(account: Account): Promise<void> {
    return this.save(account);
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(id).update(data);
    } catch (error) {
      throw new InfrastructureError('Error updating account', error);
    }
  }

  async deactivateAccount(id: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(id).update({ active: false });
    } catch (error) {
      throw new InfrastructureError('Error deactivating account', error);
    }
  }

  async getAccount(id: string): Promise<Account | null> {
    return this.findById(id);
  }

  async getAccounts(companyId: string): Promise<Account[]> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('companyId', '==', companyId) // Note: Need to ensure Account entity has companyId in real impl
        .get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error fetching accounts', error);
    }
  }
}