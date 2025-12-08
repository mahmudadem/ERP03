
import { CompanyUser } from '../../../domain/rbac/CompanyUser';

export interface ICompanyUserRepository {
  get(companyId: string, userId: string): Promise<CompanyUser | null>;
  getByUserAndCompany(userId: string, companyId: string): Promise<CompanyUser | null>;
  getByCompany(companyId: string): Promise<CompanyUser[]>;
  getByRole(companyId: string, roleId: string): Promise<CompanyUser[]>;
  getMembershipsByUser(userId: string): Promise<Array<CompanyUser & { companyId: string }>>;
  assignRole(companyUser: CompanyUser): Promise<void>;
  removeRole(userId: string, companyId: string): Promise<void>;
  create(companyUser: CompanyUser): Promise<void>;
  update(userId: string, companyId: string, updates: Partial<CompanyUser>): Promise<void>;
}
