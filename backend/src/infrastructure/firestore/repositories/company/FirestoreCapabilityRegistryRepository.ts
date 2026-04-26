import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ICapabilityRegistryRepository } from '../../../../repository/interfaces/company/ICapabilityRegistryRepository';
import { CapabilityRegistry, CompanyCapability } from '../../../../domain/company/entities/CompanyCapability';

export class FirestoreCapabilityRegistryRepository implements ICapabilityRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'capabilities';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<CapabilityRegistry[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => this.mapToDomain(doc));
  }

  async getById(id: string): Promise<CapabilityRegistry | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return this.mapToDomain(doc);
  }

  async getByCode(code: string): Promise<CapabilityRegistry | null> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('code', '==', code).limit(1).get();
    if (snapshot.empty) return null;
    return this.mapToDomain(snapshot.docs[0]);
  }

  async getByModuleId(moduleId: string): Promise<CapabilityRegistry[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('moduleId', '==', moduleId).get();
    return snapshot.docs.map(doc => this.mapToDomain(doc));
  }

  async getReady(moduleId?: string): Promise<CapabilityRegistry[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('lifecycleStatus', '==', 'ready').get();
    const results = snapshot.docs.map(doc => this.mapToDomain(doc));
    if (moduleId) {
      return results.filter(c => c.moduleId === moduleId);
    }
    return results;
  }

  async create(capability: CapabilityRegistry): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(capability.id).set({
      id: capability.id,
      code: capability.code,
      moduleId: capability.moduleId,
      name: capability.name,
      description: capability.description,
      lifecycleStatus: capability.lifecycleStatus,
      runtimeStatus: capability.runtimeStatus,
      implementationStatus: capability.implementationStatus,
      implementationError: capability.implementationError,
      implementationCheckedAt: capability.implementationCheckedAt,
      enablementPolicy: capability.enablementPolicy,
      requiresMigration: capability.requiresMigration,
      createdAt: capability.createdAt,
      updatedAt: capability.updatedAt,
    });
  }

  async update(id: string, updates: Partial<CapabilityRegistry>): Promise<void> {
    const updateData: any = { updatedAt: FieldValue.serverTimestamp() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.lifecycleStatus !== undefined) updateData.lifecycleStatus = updates.lifecycleStatus;
    if (updates.runtimeStatus !== undefined) updateData.runtimeStatus = updates.runtimeStatus;
    if (updates.implementationStatus !== undefined) updateData.implementationStatus = updates.implementationStatus;
    if (updates.implementationError !== undefined) updateData.implementationError = updates.implementationError;
    if (updates.enablementPolicy !== undefined) updateData.enablementPolicy = updates.enablementPolicy;

    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }

  async getByCompanyId(companyId: string): Promise<CompanyCapability[]> {
    const snapshot = await this.db.collection('companies').doc(companyId)
      .collection('capabilities').get();
    return snapshot.docs.map(doc => this.mapCompanyToDomain(doc.data(), companyId));
  }

  async getByCompanyAndCapability(companyId: string, capabilityId: string): Promise<CompanyCapability | null> {
    const doc = await this.db.collection('companies').doc(companyId)
      .collection('capabilities').doc(capabilityId).get();
    if (!doc.exists) return null;
    return this.mapCompanyToDomain(doc.data(), companyId);
  }

  async setEnabled(companyId: string, capabilityId: string, isEnabled: boolean): Promise<void> {
    const docRef = this.db.collection('companies').doc(companyId).collection('capabilities').doc(capabilityId);
    const existing = await docRef.get();

    if (existing.exists) {
      await docRef.update({
        isEnabled,
        enabledAt: isEnabled ? FieldValue.serverTimestamp() : FieldValue.delete(),
        disabledAt: !isEnabled ? FieldValue.serverTimestamp() : FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (isEnabled) {
      await docRef.set({
        companyId,
        capabilityId,
        isEnabled: true,
        enabledAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  async setConfig(companyId: string, capabilityId: string, config: Record<string, any>): Promise<void> {
    const docRef = this.db.collection('companies').doc(companyId).collection('capabilities').doc(capabilityId);
    const existing = await docRef.get();

    if (existing.exists) {
      await docRef.update({
        config,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.set({
        companyId,
        capabilityId,
        isEnabled: false,
        config,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  private mapToDomain(doc: any): CapabilityRegistry {
    const data = doc.data();
    return {
      id: data.id,
      code: data.code,
      moduleId: data.moduleId,
      name: data.name,
      description: data.description ?? undefined,
      lifecycleStatus: data.lifecycleStatus as CapabilityRegistry['lifecycleStatus'],
      runtimeStatus: data.runtimeStatus as CapabilityRegistry['runtimeStatus'],
      implementationStatus: data.implementationStatus as CapabilityRegistry['implementationStatus'],
      implementationError: data.implementationError ?? undefined,
      implementationCheckedAt: data.implementationCheckedAt?.toDate() ?? undefined,
      enablementPolicy: data.enablementPolicy as CapabilityRegistry['enablementPolicy'],
      requiresMigration: data.requiresMigration ?? false,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date(),
    };
  }

  private mapCompanyToDomain(data: any, companyId: string): CompanyCapability {
    return {
      companyId,
      capabilityId: data.capabilityId,
      isEnabled: data.isEnabled ?? false,
      config: data.config || {},
      enabledAt: data.enabledAt?.toDate() ?? undefined,
      disabledAt: data.disabledAt?.toDate() ?? undefined,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? undefined,
    };
  }
}