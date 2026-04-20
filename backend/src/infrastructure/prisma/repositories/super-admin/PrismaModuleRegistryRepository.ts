import { PrismaClient } from '@prisma/client';
import { IModuleRegistryRepository } from '../../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleDefinition } from '../../../../domain/super-admin/ModuleDefinition';

export class PrismaModuleRegistryRepository implements IModuleRegistryRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<ModuleDefinition[]> {
    const records = await this.prisma.moduleRegistry.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(id: string): Promise<ModuleDefinition | null> {
    const record = await this.prisma.moduleRegistry.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(module: ModuleDefinition): Promise<void> {
    await this.prisma.moduleRegistry.create({
      data: {
        id: module.id,
        code: module.id,
        name: module.name,
        version: '1.0.0',
        description: module.description,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
      },
    });
  }

  async update(id: string, module: Partial<ModuleDefinition>): Promise<void> {
    await this.prisma.moduleRegistry.update({
      where: { id },
      data: {
        name: module.name,
        description: module.description,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.moduleRegistry.delete({
      where: { id },
    });
  }

  private toDomain(record: any): ModuleDefinition {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
