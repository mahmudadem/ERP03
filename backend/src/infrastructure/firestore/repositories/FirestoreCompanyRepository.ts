
import * as admin from 'firebase-admin';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../domain/core/entities/Company';

export class FirestoreCompanyRepository implements ICompanyRepository {
  private db: admin.firestore.Firestore;
  private collectionName = 'companies';

  constructor(dbInstance: admin.firestore.Firestore) {
    this.db = dbInstance;
  }

  async save(company: Company): Promise<void> {
    await this.db.collection(this.collectionName).doc(company.id).set({
      id: company.id,
      name: company.name,
      ownerId: company.ownerId,
      taxId: company.taxId,
      address: company.address || null,
      baseCurrency: company.baseCurrency,
      fiscalYearStart: admin.firestore.Timestamp.fromDate(company.fiscalYearStart),
      fiscalYearEnd: admin.firestore.Timestamp.fromDate(company.fiscalYearEnd),
      modules: company.modules,
      createdAt: admin.firestore.Timestamp.fromDate(company.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(company.updatedAt),
    });
  }

  async findById(id: string): Promise<Company | null> {
    const doc = await this.db.collection(this.collectionName).doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return this.mapToEntity(data);
  }

  async findByTaxId(taxId: string): Promise<Company | null> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('taxId', '==', taxId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return this.mapToEntity(snapshot.docs[0].data());
  }

  async getUserCompanies(userId: string): Promise<Company[]> {
    // Note: In a real app, this would likely query a separate 'company_users' collection
    // For MVP, we assume we might query by ownerId, or this needs to be implemented in a Join table repo
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('ownerId', '==', userId)
      .get();
    
    return snapshot.docs.map(doc => this.mapToEntity(doc.data()));
  }

  async enableModule(companyId: string, moduleName: string): Promise<void> {
    await this.db.collection(this.collectionName).doc(companyId).update({
      modules: admin.firestore.FieldValue.arrayUnion(moduleName)
    });
  }

  private mapToEntity(data: any): Company {
    return new Company(
      data.id,
      data.name,
      data.ownerId || 'legacy_owner',
      data.createdAt.toDate(),
      data.updatedAt.toDate(),
      data.baseCurrency || 'USD',
      data.fiscalYearStart ? data.fiscalYearStart.toDate() : new Date(new Date().getFullYear(), 0, 1),
      data.fiscalYearEnd ? data.fiscalYearEnd.toDate() : new Date(new Date().getFullYear(), 11, 31),
      data.modules || ['CORE'],
      data.taxId,
      data.address
    );
  }
}
