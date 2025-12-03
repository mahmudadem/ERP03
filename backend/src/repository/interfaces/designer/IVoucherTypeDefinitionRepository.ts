
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';

/**
 * Interface for Dynamic Voucher Types.
 */
export interface IVoucherTypeDefinitionRepository {
  createVoucherType(def: VoucherTypeDefinition): Promise<void>;
  updateVoucherType(id: string, data: Partial<VoucherTypeDefinition>): Promise<void>;
  getVoucherType(id: string): Promise<VoucherTypeDefinition | null>;
  getVoucherTypesForModule(module: string): Promise<VoucherTypeDefinition[]>;
  getByCompanyId(companyId: string): Promise<VoucherTypeDefinition[]>;
  getByCode(companyId: string, code: string): Promise<VoucherTypeDefinition | null>;
  updateLayout(companyId: string, code: string, layout: any): Promise<void>;
}
