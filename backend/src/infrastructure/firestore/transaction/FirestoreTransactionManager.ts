import * as admin from 'firebase-admin';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';

export class FirestoreTransactionManager implements ITransactionManager {
  constructor(private db: admin.firestore.Firestore) {}

  async runTransaction<T>(operation: (transaction: admin.firestore.Transaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(operation);
  }
}
