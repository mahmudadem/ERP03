
import { IBusinessDomainRepository } from '../../../repository/interfaces/super-admin/IBusinessDomainRepository';
import { BusinessDomainDefinition } from '../../../domain/super-admin/BusinessDomainDefinition';

interface CreateBusinessDomainInput {
  id: string;
  name: string;
  description: string;
}

export class CreateBusinessDomainUseCase {
  constructor(private businessDomainRepo: IBusinessDomainRepository) {}

  async execute(input: CreateBusinessDomainInput): Promise<void> {
    const domain: BusinessDomainDefinition = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.businessDomainRepo.create(domain);
  }
}
