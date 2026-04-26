import * as admin from 'firebase-admin';
import { ICompanyModuleRepository } from '../../../../repository/interfaces/company/ICompanyModuleRepository';
import { CompanyModule } from '../../../../domain/company/entities/CompanyModule';

/**
 * Firestore implementation of CompanyModule repository
 * Collection path: companies/{companyId}/modules/{moduleCode}
 */
export class FirestoreCompanyModuleRepository implements ICompanyModuleRepository {
  constructor(private db: admin.firestore.Firestore) {}

  async get(companyId: string, moduleCode: string): Promise<CompanyModule | null> {
    const docRef = this.db
      .collection('companies')
      .doc(companyId)
      .collection('modules')
      .doc(moduleCode);

    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    return this.mapFromFirestore(snapshot.data()!);
  }

  async listByCompany(companyId: string): Promise<CompanyModule[]> {
    const snapshot = await this.db
      .collection('companies')
      .doc(companyId)
      .collection('modules')
      .get();

    return snapshot.docs.map(doc => this.mapFromFirestore(doc.data()));
  }

  async create(module: CompanyModule): Promise<void> {
    const docRef = this.db
      .collection('companies')
      .doc(module.companyId)
      .collection('modules')
      .doc(module.moduleCode);

    await docRef.set(this.mapToFirestore(module));
  }

  async update(companyId: string, moduleCode: string, updates: Partial<CompanyModule>): Promise<void> {
    const docRef = this.db
      .collection('companies')
      .doc(companyId)
      .collection('modules')
      .doc(moduleCode);

    const snapshot = await docRef.get();
    const updatedAt = updates.updatedAt || new Date();

    const firestoreUpdates: any = {};
    if (updates.isEnabled !== undefined) firestoreUpdates.isEnabled = updates.isEnabled;
    if (updates.initialized !== undefined) firestoreUpdates.initialized = updates.initialized;
    if (updates.initializationStatus !== undefined) firestoreUpdates.initializationStatus = updates.initializationStatus;
    if (updates.config !== undefined) firestoreUpdates.config = updates.config;
    firestoreUpdates.updatedAt = updatedAt;

    if (!snapshot.exists) {
      firestoreUpdates.companyId = companyId;
      firestoreUpdates.moduleCode = moduleCode;
      firestoreUpdates.installedAt = updates.installedAt || new Date();
      firestoreUpdates.isEnabled = updates.isEnabled ?? true;
      if (firestoreUpdates.initialized === undefined) firestoreUpdates.initialized = false;
      if (firestoreUpdates.initializationStatus === undefined) firestoreUpdates.initializationStatus = 'pending';
      if (firestoreUpdates.config === undefined) firestoreUpdates.config = {};
    }

    await docRef.set(firestoreUpdates, { merge: true });
  }

  async delete(companyId: string, moduleCode: string): Promise<void> {
    const docRef = this.db
      .collection('companies')
      .doc(companyId)
      .collection('modules')
      .doc(moduleCode);

    await docRef.delete();
  }

  async batchCreate(modules: CompanyModule[]): Promise<void> {
    const batch = this.db.batch();

    for (const module of modules) {
      const docRef = this.db
        .collection('companies')
        .doc(module.companyId)
        .collection('modules')
        .doc(module.moduleCode);

      batch.set(docRef, this.mapToFirestore(module));
    }

    await batch.commit();
  }

  private mapToFirestore(module: CompanyModule): any {
    return {
      companyId: module.companyId,
      moduleCode: module.moduleCode,
      isEnabled: module.isEnabled ?? true,
      installedAt: module.installedAt,
      initialized: module.initialized,
      initializationStatus: module.initializationStatus,
      config: module.config || {},
      updatedAt: module.updatedAt || null
    };
  }

  private mapFromFirestore(data: any): CompanyModule {
    return {
      companyId: data.companyId,
      moduleCode: data.moduleCode,
      isEnabled: data.isEnabled ?? true,
      installedAt: data.installedAt?.toDate() || new Date(),
      initialized: data.initialized || false,
      initializationStatus: data.initializationStatus || 'pending',
      config: data.config || {},
      updatedAt: data.updatedAt?.toDate()
    };
  }
}