import { PrismaClient } from '@prisma/client';
import { IModuleRepository } from '../../../../repository/interfaces/system/IModuleRepository';
import { Module } from '../../../../domain/system/entities/Module';

export class PrismaModuleRepository implements IModuleRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): Module {
    return new Module(
      data.id,
      data.name,
      data.enabled
    );
  }

  async findAll(): Promise<Module[]> {
    const data = await this.prisma.module.findMany({
      orderBy: { name: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async getEnabledModules(companyId: string): Promise<Module[]> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { modules: true },
    });
    if (!company) return [];
    const enabledModuleCodes = (company.modules as string[]) || [];
    const data = await this.prisma.module.findMany({
      where: {
        code: { in: enabledModuleCodes },
        enabled: true,
      },
      orderBy: { name: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async enableModule(companyId: string, moduleName: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { modules: true },
    });
    if (!company) return;
    const modules = [...((company.modules as string[]) || [])];
    if (!modules.includes(moduleName)) {
      modules.push(moduleName);
    }
    await this.prisma.company.update({
      where: { id: companyId },
      data: { modules: modules as any },
    });
  }

  async disableModule(companyId: string, moduleName: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { modules: true },
    });
    if (!company) return;
    const modules = ((company.modules as string[]) || []).filter((m) => m !== moduleName);
    await this.prisma.company.update({
      where: { id: companyId },
      data: { modules: modules as any },
    });
  }
}
