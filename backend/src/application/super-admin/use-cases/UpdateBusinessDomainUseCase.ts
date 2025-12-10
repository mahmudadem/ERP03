
import { IBusinessDomainRepository } from '../../../repository/interfaces/super-admin/IBusinessDomainRepository';

interface UpdateBusinessDomainInput {
  id: string;
  name?: string;
  description?: string;
}

export class UpdateBusinessDomainUseCase {
  constructor(private businessDomainRepo: IBusinessDomainRepository) {}

  async execute(input: UpdateBusinessDomainInput): Promise<void> {
    const { id, ...updates } = input;
    
    await this.businessDomainRepo.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}
