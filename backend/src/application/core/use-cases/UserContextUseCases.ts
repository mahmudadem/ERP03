
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/core/ICompanyUserRepository';
import { Company } from '../../../domain/core/entities/Company';

export class GetUserCompaniesUseCase {
  constructor(private companyRepository: ICompanyRepository) {}

  async execute(userId: string): Promise<Company[]> {
    return this.companyRepository.getUserCompanies(userId);
  }
}

export class InviteUserToCompanyUseCase {
  constructor(private companyUserRepository: ICompanyUserRepository) {}

  async execute(userId: string, companyId: string, role: string): Promise<void> {
    // Logic to check if already member could go here
    await this.companyUserRepository.assignUserToCompany(userId, companyId, role);
  }
}

export class AssignRoleToCompanyUserUseCase {
  constructor(private companyUserRepository: ICompanyUserRepository) {}

  async execute(userId: string, companyId: string, role: string): Promise<void> {
    // Re-assign or update role
    await this.companyUserRepository.assignUserToCompany(userId, companyId, role);
  }
}
