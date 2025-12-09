
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';

/**
 * Interface for Dynamic Voucher Types.
 */
export interface IVoucherTypeDefinitionRepository {
  createVoucherType(def: VoucherTypeDefinition): Promise<void>;
  updateVoucherType(companyId: string, id: string, data: Partial<VoucherTypeDefinition>): Promise<void>;
  getVoucherType(companyId: string, id: string): Promise<VoucherTypeDefinition | null>;
  getVoucherTypesForModule(companyId: string, module: string): Promise<VoucherTypeDefinition[]>;
  getByCompanyId(companyId: string): Promise<VoucherTypeDefinition[]>;
  getByCode(companyId: string, code: string): Promise<VoucherTypeDefinition | null>;
  updateLayout(companyId: string, code: string, layout: any): Promise<void>;
  getSystemTemplates(): Promise<VoucherTypeDefinition[]>;
  deleteVoucherType(companyId: string, id: string): Promise<void>;
}
