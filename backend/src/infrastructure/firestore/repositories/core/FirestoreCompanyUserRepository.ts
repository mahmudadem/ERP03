/**
 * FirestoreCompanyUserRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Manages many-to-many relationship between Users and Companies.
 */
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICompanyUserRepository } from '../../../../repository/interfaces/core/ICompanyUserRepository';
import { CompanyUser } from '../../../../domain/core/entities/CompanyUser';
import { CompanyUserMapper } from '../../mappers/CoreMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyUserRepository extends BaseFirestoreRepository<CompanyUser> implements ICompanyUserRepository {
  protected collectionName = 'company_users';

  protected toDomain(data: any): CompanyUser {
    return CompanyUserMapper.toDomain(data);
  }

  protected toPersistence(entity: CompanyUser): any {
    return CompanyUserMapper.toPersistence(entity);
  }

  async assignUserToCompany(userId: string, companyId: string, role: string): Promise<void> {
    try {
      const id = `${companyId}_${userId}`;
      const membership = new CompanyUser(id, userId, companyId, role, []);
      await this.save(membership);
    } catch (error) {
      throw new InfrastructureError('Error assigning user to company', error);
    }
  }

  async getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('companyId', '==', companyId)
        .get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error fetching company users', error);
    }
  }

  async getUserMembership(userId: string, companyId: string): Promise<CompanyUser | null> {
    try {
      // Assuming ID structure is composite or querying by fields
      const snapshot = await this.db.collection(this.collectionName)
        .where('companyId', '==', companyId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return this.toDomain(snapshot.docs[0].data());
    } catch (error) {
      throw new InfrastructureError('Error fetching user membership', error);
    }
  }
}