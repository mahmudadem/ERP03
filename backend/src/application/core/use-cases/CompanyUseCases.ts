
import { Company } from '../../../domain/core/entities/Company';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export class UpdateCompanySettingsUseCase {
  constructor(private companyRepository: ICompanyRepository) {}

  async execute(companyId: string, data: { name?: string; address?: string; fiscalYearStart?: Date; fiscalYearEnd?: Date }): Promise<void> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new Error('Company not found');

    if (data.name) company.name = data.name;
    if (data.address) company.address = data.address;
    if (data.fiscalYearStart) company.fiscalYearStart = data.fiscalYearStart;
    if (data.fiscalYearEnd) company.fiscalYearEnd = data.fiscalYearEnd;

    await this.companyRepository.save(company);
  }
}

export class EnableModuleForCompanyUseCase {
  constructor(private companyRepository: ICompanyRepository) {}

  async execute(companyId: string, moduleName: string): Promise<void> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new Error('Company not found');

    if (company.isModuleEnabled(moduleName)) return;

    await this.companyRepository.enableModule(companyId, moduleName);
  }
}

export class GetCompanyDetailsUseCase {
  constructor(private companyRepository: ICompanyRepository) {}

  async execute(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new Error('Company not found');
    return company;
  }
}
