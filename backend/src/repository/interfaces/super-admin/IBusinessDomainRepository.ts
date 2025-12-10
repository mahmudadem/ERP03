
import { BusinessDomainDefinition } from '../../../domain/super-admin/BusinessDomainDefinition';

/**
 * Repository interface for Business Domain management.
 */
export interface IBusinessDomainRepository {
  getAll(): Promise<BusinessDomainDefinition[]>;
  getById(id: string): Promise<BusinessDomainDefinition | null>;
  create(domain: BusinessDomainDefinition): Promise<void>;
  update(id: string, domain: Partial<BusinessDomainDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
