
import { FormDefinition } from '../../../domain/designer/entities/FormDefinition';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';

/**
 * Interface for Dynamic Form Definitions.
 */
export interface IFormDefinitionRepository {
  createFormDefinition(def: FormDefinition): Promise<void>;
  updateFormDefinition(id: string, data: Partial<FormDefinition>): Promise<void>;
  getFormDefinition(id: string): Promise<FormDefinition | null>;
  getDefinitionsForModule(module: string): Promise<FormDefinition[]>;
}

/**
 * Interface for Dynamic Voucher Types.
 */
export interface IVoucherTypeDefinitionRepository {
  createVoucherType(def: VoucherTypeDefinition): Promise<void>;
  updateVoucherType(id: string, data: Partial<VoucherTypeDefinition>): Promise<void>;
  getVoucherType(id: string): Promise<VoucherTypeDefinition | null>;
  getVoucherTypesForModule(module: string): Promise<VoucherTypeDefinition[]>;
}
