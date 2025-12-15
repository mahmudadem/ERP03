
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IFormDefinitionRepository, IVoucherTypeDefinitionRepository } from '../../../../repository/interfaces/designer';
import { FormDefinition } from '../../../../domain/designer/entities/FormDefinition';
import { VoucherTypeDefinition } from '../../../../domain/designer/entities/VoucherTypeDefinition';
import { FormDefinitionMapper, VoucherTypeDefinitionMapper } from '../../mappers/DesignerMappers';

export class FirestoreFormDefinitionRepository extends BaseFirestoreRepository<FormDefinition> implements IFormDefinitionRepository {
  protected collectionName = 'form_definitions';
  protected toDomain = FormDefinitionMapper.toDomain;
  protected toPersistence = FormDefinitionMapper.toPersistence;

  async createFormDefinition(def: FormDefinition): Promise<void> { return this.save(def); }
  async updateFormDefinition(id: string, data: Partial<FormDefinition>): Promise<void> { await this.db.collection(this.collectionName).doc(id).update(data); }
  async getFormDefinition(id: string): Promise<FormDefinition | null> { return this.findById(id); }
  async getDefinitionsForModule(module: string): Promise<FormDefinition[]> {
    const snap = await this.db.collection(this.collectionName).where('module', '==', module).get();
    return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestoreVoucherTypeDefinitionRepository extends BaseFirestoreRepository<VoucherTypeDefinition> implements IVoucherTypeDefinitionRepository {
  protected collectionName = 'voucher_types'; // Not used directly for subcollections
  protected toDomain = VoucherTypeDefinitionMapper.toDomain;
  protected toPersistence = VoucherTypeDefinitionMapper.toPersistence;

  private static readonly SYSTEM_COMPANY_ID = 'SYSTEM';
  private static readonly SYSTEM_COLLECTION_NAME = 'voucher_types';
  private static readonly SYSTEM_METADATA_COLLECTION = 'system_metadata';

  /**
   * Get company-specific voucher types collection
   */
  private getCollection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('voucher_types');
  }

  /**
   * Get top-level system voucher types collection
   */
  private getSystemCollection() {
    return this.db.collection(FirestoreVoucherTypeDefinitionRepository.SYSTEM_METADATA_COLLECTION)
      .doc(FirestoreVoucherTypeDefinitionRepository.SYSTEM_COLLECTION_NAME)
      .collection('items');
  }

  async createVoucherType(def: VoucherTypeDefinition): Promise<void> {
    const data = this.toPersistence(def);
    
    // System templates go to top-level collection, company templates go to subcollection
    if (def.companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(def.id).set(data);
    } else {
      await this.getCollection(def.companyId).doc(def.id).set(data);
    }
  }

  async updateVoucherType(companyId: string, id: string, data: Partial<VoucherTypeDefinition>): Promise<void> {
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(id).update(data);
    } else {
      await this.getCollection(companyId).doc(id).update(data);
    }
  }

  async getVoucherType(companyId: string, id: string): Promise<VoucherTypeDefinition | null> {
    const doc = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().doc(id).get()
      : await this.getCollection(companyId).doc(id).get();
    
    if (!doc.exists) return null;
    return this.toDomain(doc.data());
  }

  async getVoucherTypesForModule(companyId: string, module: string): Promise<VoucherTypeDefinition[]> {
    const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().where('module', '==', module).get()
      : await this.getCollection(companyId).where('module', '==', module).get();
    
    return snap.docs.map(d => this.toDomain(d.data()));
  }

  async getByCompanyId(companyId: string): Promise<VoucherTypeDefinition[]> {
    const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().get()
      : await this.getCollection(companyId).get();
    
    return snap.docs.map(d => this.toDomain(d.data()));
  }

  async getByCode(companyId: string, code: string): Promise<VoucherTypeDefinition | null> {
    const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
      : await this.getCollection(companyId).where('code', '==', code).limit(1).get();

    if (snap.empty) return null;
    return this.toDomain(snap.docs[0].data());
  }

  async updateLayout(companyId: string, code: string, layout: any): Promise<void> {
    const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
      : await this.getCollection(companyId).where('code', '==', code).limit(1).get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({ layout });
    }
  }

  async getSystemTemplates(): Promise<VoucherTypeDefinition[]> {
    const snap = await this.getSystemCollection().get();
    return snap.docs.map(d => this.toDomain(d.data()));
  }

  async deleteVoucherType(companyId: string, id: string): Promise<void> {
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(id).delete();
    } else {
      await this.getCollection(companyId).doc(id).delete();
    }
  }
}
