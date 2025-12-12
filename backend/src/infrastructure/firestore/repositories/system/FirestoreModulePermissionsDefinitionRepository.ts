import * as admin from 'firebase-admin';
import { IModulePermissionsDefinitionRepository } from '../../../../repository/interfaces/system/IModulePermissionsDefinitionRepository';
import { ModulePermissionsDefinition } from '../../../../domain/system/ModulePermissionsDefinition';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreModulePermissionsDefinitionRepository implements IModulePermissionsDefinitionRepository {
  private collection = 'modulePermissionsDefinitions';
  private cache: Map<string, ModulePermissionsDefinition> = new Map();

  constructor(private db: admin.firestore.Firestore) {}

  private mapDoc(doc: admin.firestore.DocumentSnapshot): ModulePermissionsDefinition {
    const data = doc.data() || {};
    return {
      moduleId: data.moduleId || doc.id,
      permissions: data.permissions || [],
      autoAttachToRoles: data.autoAttachToRoles || [],
      createdAt: (data.createdAt && typeof data.createdAt.toDate === 'function') ? data.createdAt.toDate() : new Date(),
      updatedAt: (data.updatedAt && typeof data.updatedAt.toDate === 'function') ? data.updatedAt.toDate() : new Date(),
      permissionsDefined: data.permissionsDefined ?? true
    };
  }

  private setCache(def: ModulePermissionsDefinition) {
    this.cache.set(def.moduleId, def);
  }
  private invalidate(moduleId?: string) {
    if (moduleId) this.cache.delete(moduleId);
    else this.cache.clear();
  }

  async list(): Promise<ModulePermissionsDefinition[]> {
    try {
      const snapshot = await this.db.collection(this.collection).get();
      const defs = snapshot.docs.map((d) => this.mapDoc(d));
      defs.forEach((d) => this.setCache(d));
      return defs;
    } catch (err) {
      throw new InfrastructureError('Failed to list module permissions definitions', err);
    }
  }

  async getByModuleId(moduleId: string): Promise<ModulePermissionsDefinition | null> {
    const cached = this.cache.get(moduleId);
    if (cached) return cached;
    try {
      const doc = await this.db.collection(this.collection).doc(moduleId).get();
      if (!doc.exists) return null;
      const def = this.mapDoc(doc);
      this.setCache(def);
      return def;
    } catch (err) {
      throw new InfrastructureError('Failed to get module permissions definition', err);
    }
  }

  async create(def: ModulePermissionsDefinition): Promise<void> {
    try {
      await this.db.collection(this.collection).doc(def.moduleId).set(def);
      this.invalidate(def.moduleId);
    } catch (err) {
      throw new InfrastructureError('Failed to create module permissions definition', err);
    }
  }

  async update(moduleId: string, partial: Partial<ModulePermissionsDefinition>): Promise<void> {
    try {
      await this.db.collection(this.collection).doc(moduleId).set(partial, { merge: true });
      this.invalidate(moduleId);
    } catch (err) {
      throw new InfrastructureError('Failed to update module permissions definition', err);
    }
  }

  async delete(moduleId: string): Promise<void> {
    try {
      await this.db.collection(this.collection).doc(moduleId).delete();
      this.invalidate(moduleId);
    } catch (err) {
      throw new InfrastructureError('Failed to delete module permissions definition', err);
    }
  }
}
