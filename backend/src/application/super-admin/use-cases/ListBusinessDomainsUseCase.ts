
import { IBusinessDomainRepository } from '../../../repository/interfaces/super-admin/IBusinessDomainRepository';
import { BusinessDomainDefinition } from '../../../domain/super-admin/BusinessDomainDefinition';

export class ListBusinessDomainsUseCase {
  constructor(private businessDomainRepo: IBusinessDomainRepository) {}

  async execute(): Promise<BusinessDomainDefinition[]> {
    return await this.businessDomainRepo.getAll();
  }
}
