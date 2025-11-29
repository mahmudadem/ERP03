import * as admin from 'firebase-admin';
import { IModuleSettingsDefinitionRepository } from '../../../../repository/interfaces/system/IModuleSettingsDefinitionRepository';
import { ModuleSettingsDefinition } from '../../../../domain/system/ModuleSettingsDefinition';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreModuleSettingsDefinitionRepository implements IModuleSettingsDefinitionRepository {
  private collectionName = 'moduleSettingsDefinitions';

  constructor(private db: admin.firestore.Firestore) {}

  private mapDoc(doc: admin.firestore.DocumentSnapshot): ModuleSettingsDefinition {
    const data = doc.data() || {};
    return {
      moduleId: data.moduleId || doc.id,
      fields: data.fields || [],
      createdBy: data.createdBy || '',
      updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate() : new Date(),
    };
  }

  async listDefinitions(): Promise<ModuleSettingsDefinition[]> {
    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map((doc) => this.mapDoc(doc));
    } catch (error) {
      throw new InfrastructureError('Failed to list module settings definitions', error);
    }
  }

  async getDefinition(moduleId: string): Promise<ModuleSettingsDefinition | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(moduleId).get();
      if (!doc.exists) return null;
      return this.mapDoc(doc);
    } catch (error) {
      throw new InfrastructureError('Failed to get module settings definition', error);
    }
  }

  async createDefinition(def: ModuleSettingsDefinition): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(def.moduleId).set(def);
    } catch (error) {
      throw new InfrastructureError('Failed to create module settings definition', error);
    }
  }

  async updateDefinition(moduleId: string, def: Partial<ModuleSettingsDefinition>): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(moduleId).set(def, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to update module settings definition', error);
    }
  }

  async deleteDefinition(moduleId: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(moduleId).delete();
    } catch (error) {
      throw new InfrastructureError('Failed to delete module settings definition', error);
    }
  }
}
