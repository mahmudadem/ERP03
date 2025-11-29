
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../domain/core/entities/Company';

export class ListAllCompaniesUseCase {
  constructor(
    private userRepo: IUserRepository,
    private companyRepo: ICompanyRepository
  ) {}

  async execute(actorId: string): Promise<Company[]> {
    const actor = await this.userRepo.getUserById(actorId);
    if (!actor || !actor.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can list all companies');
    }

    // This would require adding a listAll method to ICompanyRepository
    // For now, we'll throw an error indicating implementation needed
    throw new Error('ListAllCompanies requires ICompanyRepository.listAll() implementation');
  }
}
