import * as admin from 'firebase-admin';
import { CompanyCreationSession } from '../../../../domain/company-wizard';
import { ICompanyCreationSessionRepository } from '../../../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyCreationSessionRepository implements ICompanyCreationSessionRepository {
  private collectionName = 'company_creation_sessions';

  constructor(private db: admin.firestore.Firestore) {}

  private mapDoc(doc: admin.firestore.DocumentSnapshot): CompanyCreationSession {
    const data = doc.data() || {};
    const createdAt = data.createdAt instanceof admin.firestore.Timestamp
      ? data.createdAt.toDate()
      : data.createdAt ? new Date(data.createdAt) : new Date();
    const updatedAt = data.updatedAt instanceof admin.firestore.Timestamp
      ? data.updatedAt.toDate()
      : data.updatedAt ? new Date(data.updatedAt) : new Date();

    return {
      id: data.id || doc.id,
      userId: data.userId,
      model: data.model,
      templateId: data.templateId,
      currentStepId: data.currentStepId,
      data: data.data || {},
      createdAt,
      updatedAt,
    };
  }

  private toPersistence(session: CompanyCreationSession) {
    return {
      ...session,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async create(session: CompanyCreationSession): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(session.id).set(this.toPersistence(session));
    } catch (error) {
      throw new InfrastructureError('Failed to create company creation session', error);
    }
  }

  async update(session: CompanyCreationSession): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(session.id).set(this.toPersistence(session), { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to update company creation session', error);
    }
  }

  async getById(id: string): Promise<CompanyCreationSession | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(id).get();
      if (!doc.exists) return null;
      return this.mapDoc(doc);
    } catch (error) {
      throw new InfrastructureError('Failed to get company creation session', error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(id).delete();
    } catch (error) {
      throw new InfrastructureError('Failed to delete company creation session', error);
    }
  }
}
