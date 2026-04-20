import { PrismaClient } from '@prisma/client';
import { ICompanyModuleRepository } from '../../../../repository/interfaces/company/ICompanyModuleRepository';
import { CompanyModule, CompanyModuleEntity } from '../../../../domain/company/entities/CompanyModule';

export class PrismaCompanyModuleRepository implements ICompanyModuleRepository {
  constructor(private prisma: PrismaClient) {}

  async get(companyId: string, moduleCode: string): Promise<CompanyModule | null> {
    const record = await this.prisma.companyModule.findUnique({
      where: { companyId_moduleCode: { companyId, moduleCode } },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async listByCompany(companyId: string): Promise<CompanyModule[]> {
    const records = await this.prisma.companyModule.findMany({
      where: { companyId },
      orderBy: { moduleCode: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(module: CompanyModule): Promise<void> {
    await this.prisma.companyModule.create({
      data: {
        companyId: module.companyId,
        moduleCode: module.moduleCode,
        installedAt: module.installedAt,
        initialized: module.initialized,
        initializationStatus: module.initializationStatus,
        config: module.config as any,
      },
    });
  }

  async update(companyId: string, moduleCode: string, updates: Partial<CompanyModule>): Promise<void> {
    const data: any = {};
    if (updates.initialized !== undefined) data.initialized = updates.initialized;
    if (updates.initializationStatus !== undefined) data.initializationStatus = updates.initializationStatus;
    if (updates.config !== undefined) data.config = updates.config as any;
    if (updates.installedAt !== undefined) data.installedAt = updates.installedAt;
    data.updatedAt = new Date();

    await this.prisma.companyModule.update({
      where: { companyId_moduleCode: { companyId, moduleCode } },
      data,
    });
  }

  async delete(companyId: string, moduleCode: string): Promise<void> {
    await this.prisma.companyModule.delete({
      where: { companyId_moduleCode: { companyId, moduleCode } },
    });
  }

  async batchCreate(modules: CompanyModule[]): Promise<void> {
    await this.prisma.$transaction(
      modules.map((m) =>
        this.prisma.companyModule.create({
          data: {
            companyId: m.companyId,
            moduleCode: m.moduleCode,
            installedAt: m.installedAt,
            initialized: m.initialized,
            initializationStatus: m.initializationStatus,
            config: m.config as any,
          },
        })
      )
    );
  }

  private toDomain(record: any): CompanyModule {
    return {
      companyId: record.companyId,
      moduleCode: record.moduleCode,
      installedAt: record.installedAt,
      initialized: record.initialized,
      initializationStatus: record.initializationStatus as 'pending' | 'in_progress' | 'complete',
      config: (record.config as Record<string, any>) || {},
      updatedAt: record.updatedAt ?? undefined,
    };
  }
}
