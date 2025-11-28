
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
  protected collectionName = 'voucher_type_definitions';
  protected toDomain = VoucherTypeDefinitionMapper.toDomain;
  protected toPersistence = VoucherTypeDefinitionMapper.toPersistence;

  async createVoucherType(def: VoucherTypeDefinition): Promise<void> { return this.save(def); }
  async updateVoucherType(id: string, data: Partial<VoucherTypeDefinition>): Promise<void> { await this.db.collection(this.collectionName).doc(id).update(data); }
  async getVoucherType(id: string): Promise<VoucherTypeDefinition | null> { return this.findById(id); }
  async getVoucherTypesForModule(module: string): Promise<VoucherTypeDefinition[]> {
      const snap = await this.db.collection(this.collectionName).where('module', '==', module).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}
