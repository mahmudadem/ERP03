
import { IBusinessDomainRepository } from '../../../repository/interfaces/super-admin/IBusinessDomainRepository';

export class DeleteBusinessDomainUseCase {
  constructor(private businessDomainRepo: IBusinessDomainRepository) {}

  async execute(id: string): Promise<void> {
    await this.businessDomainRepo.delete(id);
  }
}
