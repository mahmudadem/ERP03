import { Prisma, PrismaClient } from '@prisma/client';
import { ICapabilityRegistryRepository } from '../../../../repository/interfaces/company/ICapabilityRegistryRepository';
import { CapabilityRegistry, CompanyCapability, CompanyCapabilityEntity } from '../../../../domain/company/entities/CompanyCapability';

export class PrismaCapabilityRegistryRepository implements ICapabilityRegistryRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<CapabilityRegistry[]> {
    const records = await this.prisma.moduleCapabilityRegistry.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map(r => this.toDomain(r));
  }

  async getById(id: string): Promise<CapabilityRegistry | null> {
    const record = await this.prisma.moduleCapabilityRegistry.findUnique({
      where: { id },
    });
    return record ? this.toDomain(record) : null;
  }

  async getByCode(code: string): Promise<CapabilityRegistry | null> {
    const record = await this.prisma.moduleCapabilityRegistry.findUnique({
      where: { code },
    });
    return record ? this.toDomain(record) : null;
  }

  async getByModuleId(moduleId: string): Promise<CapabilityRegistry[]> {
    const records = await this.prisma.moduleCapabilityRegistry.findMany({
      where: { moduleId },
      orderBy: { name: 'asc' },
    });
    return records.map(r => this.toDomain(r));
  }

  async getReady(moduleId?: string): Promise<CapabilityRegistry[]> {
    const where: Prisma.ModuleCapabilityRegistryWhereInput = { lifecycleStatus: 'ready' };
    if (moduleId) where.moduleId = moduleId;
    const records = await this.prisma.moduleCapabilityRegistry.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return records.map(r => this.toDomain(r));
  }

  async create(capability: CapabilityRegistry): Promise<void> {
    await this.prisma.moduleCapabilityRegistry.create({
      data: {
        id: capability.id,
        code: capability.code,
        moduleId: capability.moduleId,
        name: capability.name,
        description: capability.description,
        lifecycleStatus: capability.lifecycleStatus,
        runtimeStatus: capability.runtimeStatus,
        implementationStatus: capability.implementationStatus,
        implementationError: capability.implementationError,
        implementationCheckedAt: capability.implementationCheckedAt,
        enablementPolicy: capability.enablementPolicy,
        requiresMigration: capability.requiresMigration,
        createdAt: capability.createdAt,
        updatedAt: capability.updatedAt,
      },
    });
  }

  async update(id: string, updates: Partial<CapabilityRegistry>): Promise<void> {
    const data: Prisma.ModuleCapabilityRegistryUncheckedUpdateInput = { updatedAt: new Date() };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.lifecycleStatus !== undefined) data.lifecycleStatus = updates.lifecycleStatus;
    if (updates.runtimeStatus !== undefined) data.runtimeStatus = updates.runtimeStatus;
    if (updates.implementationStatus !== undefined) data.implementationStatus = updates.implementationStatus;
    if (updates.implementationError !== undefined) data.implementationError = updates.implementationError;
    if (updates.enablementPolicy !== undefined) data.enablementPolicy = updates.enablementPolicy;

    await this.prisma.moduleCapabilityRegistry.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.moduleCapabilityRegistry.delete({
      where: { id },
    });
  }

  async getByCompanyId(companyId: string): Promise<CompanyCapability[]> {
    const records = await this.prisma.companyCapability.findMany({
      where: { companyId },
      orderBy: { capabilityId: 'asc' },
    });
    return records.map(r => this.toCompanyDomain(r));
  }

  async getByCompanyAndCapability(companyId: string, capabilityId: string): Promise<CompanyCapability | null> {
    const record = await this.prisma.companyCapability.findUnique({
      where: { companyId_capabilityId: { companyId, capabilityId } },
    });
    return record ? this.toCompanyDomain(record) : null;
  }

  async setEnabled(companyId: string, capabilityId: string, isEnabled: boolean): Promise<void> {
    const existing = await this.prisma.companyCapability.findUnique({
      where: { companyId_capabilityId: { companyId, capabilityId } },
    });

    if (existing) {
      await this.prisma.companyCapability.update({
        where: { companyId_capabilityId: { companyId, capabilityId } },
        data: {
          isEnabled,
          enabledAt: isEnabled ? new Date() : undefined,
          disabledAt: !isEnabled ? new Date() : undefined,
          updatedAt: new Date(),
        },
      });
    } else if (isEnabled) {
      await this.prisma.companyCapability.create({
        data: {
          companyId,
          capabilityId,
          isEnabled: true,
          enabledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }

  async setConfig(companyId: string, capabilityId: string, config: Record<string, any>): Promise<void> {
    const existing = await this.prisma.companyCapability.findUnique({
      where: { companyId_capabilityId: { companyId, capabilityId } },
    });

    if (existing) {
      await this.prisma.companyCapability.update({
        where: { companyId_capabilityId: { companyId, capabilityId } },
        data: {
          config: config,
          updatedAt: new Date(),
        },
      });
    }
  }

  private toDomain(record: any): CapabilityRegistry {
    return {
      id: record.id,
      code: record.code,
      moduleId: record.moduleId,
      name: record.name,
      description: record.description ?? undefined,
      lifecycleStatus: record.lifecycleStatus as CapabilityRegistry['lifecycleStatus'],
      runtimeStatus: record.runtimeStatus as CapabilityRegistry['runtimeStatus'],
      implementationStatus: record.implementationStatus as CapabilityRegistry['implementationStatus'],
      implementationError: record.implementationError ?? undefined,
      implementationCheckedAt: record.implementationCheckedAt ?? undefined,
      enablementPolicy: record.enablementPolicy as CapabilityRegistry['enablementPolicy'],
      requiresMigration: record.requiresMigration,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toCompanyDomain(record: any): CompanyCapability {
    return {
      companyId: record.companyId,
      capabilityId: record.capabilityId,
      isEnabled: record.isEnabled,
      config: (record.config as Record<string, any>) || {},
      enabledAt: record.enabledAt ?? undefined,
      disabledAt: record.disabledAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt ?? undefined,
    };
  }
}