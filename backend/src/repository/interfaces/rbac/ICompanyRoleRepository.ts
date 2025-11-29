
import { CompanyRole } from '../../../domain/rbac/CompanyRole';

export interface ICompanyRoleRepository {
  getAll(companyId: string): Promise<CompanyRole[]>;
  getById(companyId: string, roleId: string): Promise<CompanyRole | null>;
  create(role: CompanyRole): Promise<void>;
  update(companyId: string, roleId: string, role: Partial<CompanyRole>): Promise<void>;
  delete(companyId: string, roleId: string): Promise<void>;
}
