import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IModuleRegistryRepository } from '../../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import {
  ModuleDefinition,
  LifecycleStatus,
  RuntimeStatus,
  ImplementationStatus,
} from '../../../../domain/super-admin/ModuleDefinition';

export class FirestoreModuleRegistryRepository implements IModuleRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'modules';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<ModuleDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map((doc) => this.toDomain(doc));
  }

  async getById(id: string): Promise<ModuleDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return this.toDomain(doc);
  }

  async getByCode(code: string): Promise<ModuleDefinition | null> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('code', '==', code).get();
    if (snapshot.empty) return null;
    return this.toDomain(snapshot.docs[0]);
  }

  async create(module: ModuleDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(module.id).set({
      id: module.id,
      code: module.code,
      name: module.name,
      description: module.description,
      version: module.version,
      lifecycleStatus: module.lifecycleStatus,
      runtimeStatus: module.runtimeStatus,
      implementationStatus: module.implementationStatus,
      implementationError: module.implementationError,
      implementationCheckedAt: module.implementationCheckedAt,
      releaseNotes: module.releaseNotes,
      dependencies: module.dependencies,
      businessDomainId: module.businessDomainId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, module: Partial<ModuleDefinition>): Promise<void> {
    const updateData: any = { ...module };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async updateImplementationCheck(
    id: string,
    status: ImplementationStatus,
    error: string | null,
    checkedAt: Date
  ): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update({
      implementationStatus: status,
      implementationError: error,
      implementationCheckedAt: checkedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async updateLifecycleStatus(id: string, status: LifecycleStatus): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update({
      lifecycleStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async updateRuntimeStatus(id: string, status: RuntimeStatus): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update({
      runtimeStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }

  async getByLifecycleStatus(status: LifecycleStatus): Promise<ModuleDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('lifecycleStatus', '==', status).get();
    return snapshot.docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: admin.firestore.DocumentSnapshot): ModuleDefinition {
    const data = doc.data()!;
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description ?? '',
      version: data.version ?? '1.0.0',
      lifecycleStatus: (data.lifecycleStatus as LifecycleStatus) ?? 'draft',
      runtimeStatus: (data.runtimeStatus as RuntimeStatus) ?? 'available',
      implementationStatus: (data.implementationStatus as ImplementationStatus) ?? 'unchecked',
      implementationError: data.implementationError ?? undefined,
      implementationCheckedAt: data.implementationCheckedAt?.toDate() ?? undefined,
      releaseNotes: data.releaseNotes ?? undefined,
      dependencies: data.dependencies ?? [],
      businessDomainId: data.businessDomainId ?? undefined,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date(),
    };
  }
}