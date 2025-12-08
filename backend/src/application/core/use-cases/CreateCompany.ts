
import { Company } from '../../../domain/core/entities/Company';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

interface CreateCompanyDTO {
  name: string;
  taxId: string;
  address?: string;
}

export class CreateCompanyUseCase {
  constructor(private companyRepository: ICompanyRepository) {}

  async execute(dto: CreateCompanyDTO): Promise<Company> {
    const existing = await this.companyRepository.findByTaxId(dto.taxId);
    if (existing) {
      throw new Error('Company with this Tax ID already exists.');
    }

    const id = `cmp_${Date.now()}`; // Simplified ID generation for MVP
    const now = new Date();
    const currentYear = now.getFullYear();

    const newCompany = new Company(
      id,
      dto.name,
      'temp_owner_id', // Placeholder for MVP as ownerId is not yet in DTO
      now,
      now,
      'USD', // Default Base Currency
      new Date(currentYear, 0, 1), // Default Fiscal Year Start (Jan 1)
      new Date(currentYear, 11, 31), // Default Fiscal Year End (Dec 31)
      ['CORE'], // Default Modules
      [], // features
      dto.taxId,
      undefined,
      dto.address
    );

    if (!newCompany.isValid()) {
      throw new Error('Invalid company data.');
    }

    await this.companyRepository.save(newCompany);

    return newCompany;
  }
}
