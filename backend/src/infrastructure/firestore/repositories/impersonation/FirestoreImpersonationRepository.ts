
import { IImpersonationRepository } from '../../../../repository/interfaces/impersonation/IImpersonationRepository';
import { ImpersonationSession } from '../../../../domain/impersonation/ImpersonationSession';
import { ImpersonationMapper } from '../../mappers/ImpersonationMapper';
import { InfrastructureError } from '../../../errors/InfrastructureError';
import * as admin from 'firebase-admin';

export class FirestoreImpersonationRepository implements IImpersonationRepository {
  private collectionName = 'impersonation_sessions';
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async startSession(superAdminId: string, companyId: string): Promise<ImpersonationSession> {
    try {
      const sessionId = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session = new ImpersonationSession(
        sessionId,
        superAdminId,
        companyId,
        true,
        new Date()
      );

      const data = ImpersonationMapper.toPersistence(session);
      await this.db.collection(this.collectionName).doc(sessionId).set(data);

      return session;
    } catch (error) {
      throw new InfrastructureError('Error starting impersonation session', error);
    }
  }

  async getSession(sessionId: string): Promise<ImpersonationSession | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(sessionId).get();
      if (!doc.exists) return null;

      const data = doc.data();
      return ImpersonationMapper.toDomain({ ...data, id: doc.id });
    } catch (error) {
      throw new InfrastructureError('Error getting impersonation session', error);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(sessionId).update({
        active: false,
        endedAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      throw new InfrastructureError('Error ending impersonation session', error);
    }
  }

  async getActiveSessionBySuperAdmin(superAdminId: string): Promise<ImpersonationSession | null> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('superAdminId', '==', superAdminId)
        .where('active', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return ImpersonationMapper.toDomain({ ...data, id: doc.id });
    } catch (error) {
      throw new InfrastructureError('Error getting active impersonation session', error);
    }
  }
}
