import { PrismaClient } from '@prisma/client';
import { ICompanyModuleSettingsRepository, CompanyModuleSettings } from '../../../../repository/interfaces/system/ICompanyModuleSettingsRepository';

export class PrismaCompanyModuleSettingsRepository implements ICompanyModuleSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async findByCompanyId(companyId: string): Promise<any[]> {
    const data = await this.prisma.companyModuleSettings.findMany({
      where: { companyId },
    });
    return data.map((d) => ({
      id: d.id,
      companyId: d.companyId,
      moduleId: d.moduleId,
      settings: d.settings,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async create(settings: any): Promise<void> {
    await this.prisma.companyModuleSettings.create({
      data: {
        id: settings.id,
        companyId: settings.companyId,
        moduleId: settings.moduleId,
        settings: settings.settings as any,
      },
    });
  }

  async update(companyId: string, moduleId: string, settings: any): Promise<void> {
    await this.prisma.companyModuleSettings.update({
      where: { companyId_moduleId: { companyId, moduleId } },
      data: { settings: settings as any },
    });
  }

  async getSettings(companyId: string, moduleId: string): Promise<CompanyModuleSettings | null> {
    const data = await this.prisma.companyModuleSettings.findUnique({
      where: { companyId_moduleId: { companyId, moduleId } },
    });
    if (!data) return null;
    return data.settings as any;
  }

  async saveSettings(companyId: string, moduleId: string, settings: CompanyModuleSettings, userId: string): Promise<void> {
    await this.prisma.companyModuleSettings.upsert({
      where: { companyId_moduleId: { companyId, moduleId } },
      create: {
        companyId,
        moduleId,
        settings: settings as any,
      },
      update: {
        settings: settings as any,
      },
    });
  }

  async ensureModuleIsActivated(companyId: string, moduleId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { modules: true },
    });
    if (!company) return;
    const modules = [...((company.modules as string[]) || [])];
    if (!modules.includes(moduleId)) {
      modules.push(moduleId);
      await this.prisma.company.update({
        where: { id: companyId },
        data: { modules: modules as any },
      });
    }
  }
}
