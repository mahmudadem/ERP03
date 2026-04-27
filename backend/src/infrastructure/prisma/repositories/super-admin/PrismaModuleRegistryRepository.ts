import { PrismaClient } from '@prisma/client';
import { IModuleRegistryRepository } from '../../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import {
  ModuleDefinition,
  LifecycleStatus,
  RuntimeStatus,
  ImplementationStatus,
} from '../../../../domain/super-admin/ModuleDefinition';

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

  async getByCode(code: string): Promise<ModuleDefinition | null> {
    const record = await this.prisma.moduleRegistry.findUnique({
      where: { code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(module: ModuleDefinition): Promise<void> {
    await this.prisma.moduleRegistry.create({
      data: {
        id: module.id,
        code: module.code,
        name: module.name,
        version: module.version,
        description: module.description,
        lifecycleStatus: module.lifecycleStatus,
        runtimeStatus: module.runtimeStatus,
        implementationStatus: module.implementationStatus,
        implementationError: module.implementationError,
        implementationCheckedAt: module.implementationCheckedAt,
        releaseNotes: module.releaseNotes,
        dependencies: module.dependencies,
        businessDomainId: module.businessDomainId,
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
        version: module.version,
        lifecycleStatus: module.lifecycleStatus,
        runtimeStatus: module.runtimeStatus,
        implementationStatus: module.implementationStatus,
        implementationError: module.implementationError,
        implementationCheckedAt: module.implementationCheckedAt,
        releaseNotes: module.releaseNotes,
        dependencies: module.dependencies,
        businessDomainId: module.businessDomainId,
        updatedAt: new Date(),
      },
    });
  }

  async updateImplementationCheck(
    id: string,
    status: ImplementationStatus,
    error: string | null,
    checkedAt: Date
  ): Promise<void> {
    await this.prisma.moduleRegistry.update({
      where: { id },
      data: {
        implementationStatus: status,
        implementationError: error,
        implementationCheckedAt: checkedAt,
        updatedAt: new Date(),
      },
    });
  }

  async updateLifecycleStatus(id: string, status: LifecycleStatus): Promise<void> {
    await this.prisma.moduleRegistry.update({
      where: { id },
      data: {
        lifecycleStatus: status,
        updatedAt: new Date(),
      },
    });
  }

  async updateRuntimeStatus(id: string, status: RuntimeStatus): Promise<void> {
    await this.prisma.moduleRegistry.update({
      where: { id },
      data: {
        runtimeStatus: status,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.moduleRegistry.delete({
      where: { id },
    });
  }

  async getByLifecycleStatus(status: LifecycleStatus): Promise<ModuleDefinition[]> {
    const records = await this.prisma.moduleRegistry.findMany({
      where: { lifecycleStatus: status },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): ModuleDefinition {
    return {
      id: record.id,
      code: record.code ?? record.id,
      name: record.name,
      description: record.description ?? '',
      version: record.version ?? '1.0.0',
      lifecycleStatus: record.lifecycleStatus as LifecycleStatus,
      runtimeStatus: record.runtimeStatus as RuntimeStatus,
      implementationStatus: record.implementationStatus as ImplementationStatus,
      implementationError: record.implementationError ?? undefined,
      implementationCheckedAt: record.implementationCheckedAt ?? undefined,
      releaseNotes: record.releaseNotes ?? undefined,
      dependencies: record.dependencies ?? [],
      businessDomainId: record.businessDomainId ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
