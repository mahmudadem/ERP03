import { CompanyGroup } from '../../../domain/accounting/entities/CompanyGroup';

export interface ICompanyGroupRepository {
  create(group: CompanyGroup): Promise<CompanyGroup>;
  update(group: CompanyGroup): Promise<CompanyGroup>;
  list(companyId: string): Promise<CompanyGroup[]>; // groups that include companyId or owned by same user
  findById(id: string): Promise<CompanyGroup | null>;
}
