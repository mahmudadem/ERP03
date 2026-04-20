import { PrismaClient } from '@prisma/client';
import { ICompanyWizardTemplateRepository } from '../../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';
import { CompanyWizardTemplate } from '../../../../domain/company-wizard';

export class PrismaCompanyWizardTemplateRepository implements ICompanyWizardTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async getDefaultTemplateForModel(model: string): Promise<CompanyWizardTemplate | null> {
    const record = await this.prisma.companyWizardTemplate.findFirst({
      where: {
        isDefault: true,
        models: { has: model },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getById(id: string): Promise<CompanyWizardTemplate | null> {
    const record = await this.prisma.companyWizardTemplate.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async listAll(): Promise<CompanyWizardTemplate[]> {
    const records = await this.prisma.companyWizardTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): CompanyWizardTemplate {
    return {
      id: record.id,
      name: record.name,
      models: record.models,
      steps: record.steps as any,
      isDefault: record.isDefault,
    };
  }
}
