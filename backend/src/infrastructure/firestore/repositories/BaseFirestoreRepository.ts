/**
 * BaseFirestoreRepository.ts
 * 
 * Purpose:
 * Provides generic CRUD operations for all Firestore repositories.
 * Enforces standardized error handling via InfrastructureError.
 * 
 * Usage:
 * Extend this class and implement `collectionName`, `toDomain`, and `toPersistence`.
 */
import { Firestore, Transaction, DocumentSnapshot } from 'firebase-admin/firestore';
import { InfrastructureError } from '../../errors/InfrastructureError';

export abstract class BaseFirestoreRepository<T> {
  protected abstract collectionName: string;
  protected db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  protected abstract toDomain(data: any): T;
  protected abstract toPersistence(entity: T): any;

  /**
   * Saves an entity (Create or Update).
   */
  async save(entity: T, transaction?: Transaction): Promise<void> {
    try {
      const data = this.toPersistence(entity);
      // specific logic relies on the entity having an 'id' field
      const id = (entity as any).id;
      if (!id) throw new Error("Entity missing ID");
      
      if (transaction) {
        transaction.set(this.db.collection(this.collectionName).doc(id), data);
      } else {
        await this.db.collection(this.collectionName).doc(id).set(data);
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error(`[INFRA] Failed to save to ${this.collectionName}`, error);
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as any).message)
        : `Failed to save to ${this.collectionName}`;
      throw new InfrastructureError(message, error);
    }
  }

  /**
   * Finds an entity by ID.
   */
  async findById(id: string, transaction?: Transaction): Promise<T | null> {
    try {
      let doc: DocumentSnapshot;
      if (transaction) {
        doc = await transaction.get(this.db.collection(this.collectionName).doc(id));
      } else {
        doc = await this.db.collection(this.collectionName).doc(id).get();
      }
      
      if (!doc.exists) return null;
      return this.toDomain(doc.data());
    } catch (error) {
      throw new InfrastructureError(`Failed to findById in ${this.collectionName}`, error);
    }
  }

  /**
   * Deletes an entity by ID.
   */
  async delete(id: string, transaction?: Transaction): Promise<void> {
    try {
      if (transaction) {
        transaction.delete(this.db.collection(this.collectionName).doc(id));
      } else {
        await this.db.collection(this.collectionName).doc(id).delete();
      }
    } catch (error) {
      throw new InfrastructureError(`Failed to delete in ${this.collectionName}`, error);
    }
  }
}
