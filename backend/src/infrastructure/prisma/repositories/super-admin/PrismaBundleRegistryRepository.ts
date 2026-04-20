import { PrismaClient } from '@prisma/client';
import { IBundleRegistryRepository } from '../../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { BundleDefinition } from '../../../../domain/super-admin/BundleDefinition';

export class PrismaBundleRegistryRepository implements IBundleRegistryRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<BundleDefinition[]> {
    const records = await this.prisma.bundleRegistry.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(id: string): Promise<BundleDefinition | null> {
    const record = await this.prisma.bundleRegistry.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(bundle: BundleDefinition): Promise<void> {
    await this.prisma.bundleRegistry.create({
      data: {
        id: bundle.id,
        code: bundle.id,
        name: bundle.name,
        description: bundle.description,
        modules: bundle.modulesIncluded,
        pricing: { businessDomains: bundle.businessDomains } as any,
        createdAt: bundle.createdAt,
        updatedAt: bundle.updatedAt,
      },
    });
  }

  async update(id: string, bundle: Partial<BundleDefinition>): Promise<void> {
    const updateData: any = {};
    if (bundle.name !== undefined) updateData.name = bundle.name;
    if (bundle.description !== undefined) updateData.description = bundle.description;
    if (bundle.modulesIncluded !== undefined) updateData.modules = bundle.modulesIncluded;
    if (bundle.businessDomains !== undefined) {
      updateData.pricing = { businessDomains: bundle.businessDomains } as any;
    }
    updateData.updatedAt = new Date();

    await this.prisma.bundleRegistry.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bundleRegistry.delete({
      where: { id },
    });
  }

  private toDomain(record: any): BundleDefinition {
    const pricing = record.pricing as any;
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      businessDomains: pricing?.businessDomains ?? [],
      modulesIncluded: record.modules ?? [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
