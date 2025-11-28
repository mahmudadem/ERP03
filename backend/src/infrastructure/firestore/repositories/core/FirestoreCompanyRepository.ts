/**
 * FirestoreCompanyRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of ICompanyRepository using Firestore.
 */
import * as admin from 'firebase-admin';
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../../domain/core/entities/Company';
import { CompanyMapper } from '../../mappers/CoreMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyRepository extends BaseFirestoreRepository<Company> implements ICompanyRepository {
  protected collectionName = 'companies';

  protected toDomain(data: any): Company {
    return CompanyMapper.toDomain(data);
  }

  protected toPersistence(entity: Company): any {
    return CompanyMapper.toPersistence(entity);
  }

  async findByTaxId(taxId: string): Promise<Company | null> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('taxId', '==', taxId)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return this.toDomain(snapshot.docs[0].data());
    } catch (error) {
      throw new InfrastructureError('Error finding company by TaxID', error);
    }
  }

  async getUserCompanies(userId: string): Promise<Company[]> {
    try {
      // In a real scenario, this might query a join collection 'company_users' first.
      // For MVP, assuming ownerId check or simple permission check logic.
      const snapshot = await this.db.collection(this.collectionName)
        .where('ownerId', '==', userId)
        .get();

      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error getting user companies', error);
    }
  }

  async enableModule(companyId: string, moduleName: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(companyId).update({
        modules: admin.firestore.FieldValue.arrayUnion(moduleName)
      });
    } catch (error) {
      throw new InfrastructureError('Error enabling module', error);
    }
  }
}