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
import * as admin from 'firebase-admin';
import { InfrastructureError } from '../../errors/InfrastructureError';

export abstract class BaseFirestoreRepository<T> {
  protected abstract collectionName: string;
  protected db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  protected abstract toDomain(data: any): T;
  protected abstract toPersistence(entity: T): any;

  /**
   * Saves an entity (Create or Update).
   */
  async save(entity: T): Promise<void> {
    try {
      const data = this.toPersistence(entity);
      // specific logic relies on the entity having an 'id' field
      const id = (entity as any).id;
      if (!id) throw new Error("Entity missing ID");
      
      await this.db.collection(this.collectionName).doc(id).set(data);
    } catch (error) {
      throw new InfrastructureError(`Failed to save to ${this.collectionName}`, error);
    }
  }

  /**
   * Finds an entity by ID.
   */
  async findById(id: string): Promise<T | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(id).get();
      if (!doc.exists) return null;
      return this.toDomain(doc.data());
    } catch (error) {
      throw new InfrastructureError(`Failed to findById in ${this.collectionName}`, error);
    }
  }

  /**
   * Deletes an entity by ID.
   */
  async delete(id: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(id).delete();
    } catch (error) {
      throw new InfrastructureError(`Failed to delete in ${this.collectionName}`, error);
    }
  }
}
