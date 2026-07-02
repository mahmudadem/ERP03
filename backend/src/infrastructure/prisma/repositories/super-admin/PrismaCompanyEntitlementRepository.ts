/**
 * Prisma Company Entitlement Repository
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { ICompanyEntitlementRepository, IBundleItemRepository } from '../../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { CompanyEntitlement, CompanyEntitlementItem, BundleDefinition, BundleItem } from '../../../../domain/super-admin/EntitlementDefinition';

export class PrismaCompanyEntitlementRepository implements ICompanyEntitlementRepository {
  constructor(private prisma: PrismaClient) {}

  async getByCompanyId(companyId: string): Promise<CompanyEntitlement[]> {
    const records = await this.prisma.companyEntitlement.findMany({
      where: { companyId },
      include: { items: true },
    });
    return records.map((r) => this.toEntitlementDomain(r));
  }

  async getActiveByCompanyId(companyId: string): Promise<CompanyEntitlement[]> {
    const now = new Date();
    const records = await this.prisma.companyEntitlement.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { validUntil: null },
          { validUntil: { gte: now } },
        ],
      },
      include: { items: true },
    });
    return records.map((r) => this.toEntitlementDomain(r));
  }

  async getEntitlementById(id: string): Promise<CompanyEntitlement | null> {
    const record = await this.prisma.companyEntitlement.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!record) return null;
    return this.toEntitlementDomain(record);
  }

  async createEntitlement(entitlement: CompanyEntitlement): Promise<void> {
    await this.prisma.companyEntitlement.create({
      data: {
        id: entitlement.id,
        companyId: entitlement.companyId,
        sourceType: entitlement.sourceType,
        sourceId: entitlement.sourceId,
        validFrom: entitlement.validFrom,
        validUntil: entitlement.validUntil,
        isActive: entitlement.isActive,
        items: {
          create: entitlement.items.map((item) => ({
            id: item.id,
            itemType: item.itemType,
            itemKey: item.itemKey,
          })),
        },
      },
    });
  }

  async updateEntitlement(id: string, updates: Partial<CompanyEntitlement>): Promise<void> {
    await this.prisma.companyEntitlement.update({
      where: { id },
      data: {
        sourceType: updates.sourceType,
        sourceId: updates.sourceId,
        validFrom: updates.validFrom,
        validUntil: updates.validUntil,
        isActive: updates.isActive,
        updatedAt: new Date(),
      },
    });
  }

  async deactivateEntitlement(id: string): Promise<void> {
    await this.prisma.companyEntitlement.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  async addItem(entitlementId: string, item: CompanyEntitlementItem): Promise<void> {
    await this.prisma.companyEntitlementItem.create({
      data: {
        id: item.id,
        entitlementId,
        itemType: item.itemType,
        itemKey: item.itemKey,
      },
    });
  }

  async removeItem(entitlementId: string, itemKey: string): Promise<void> {
    await this.prisma.companyEntitlementItem.deleteMany({
      where: { entitlementId, itemKey },
    });
  }

  async getItemsByEntitlementId(entitlementId: string): Promise<CompanyEntitlementItem[]> {
    const records = await this.prisma.companyEntitlementItem.findMany({
      where: { entitlementId },
    });
    return records.map((r) => ({
      id: r.id,
      entitlementId: r.entitlementId,
      itemType: r.itemType as 'module' | 'capability',
      itemKey: r.itemKey,
      createdAt: r.createdAt,
    }));
  }

  async getEffectiveModules(companyId: string): Promise<string[]> {
    const entitlements = await this.getActiveByCompanyId(companyId);
    const modules = new Set<string>();
    for (const entitlement of entitlements) {
      for (const item of entitlement.items) {
        if (item.itemType === 'module') {
          modules.add(item.itemKey);
        }
      }
    }
    return Array.from(modules);
  }

  async getEffectiveCapabilities(companyId: string): Promise<string[]> {
    const entitlements = await this.getActiveByCompanyId(companyId);
    const capabilities = new Set<string>();
    for (const entitlement of entitlements) {
      for (const item of entitlement.items) {
        if (item.itemType === 'capability') {
          capabilities.add(item.itemKey);
        }
      }
    }
    return Array.from(capabilities);
  }

  async hasModule(companyId: string, moduleId: string): Promise<boolean> {
    const modules = await this.getEffectiveModules(companyId);
    return modules.includes(moduleId.toLowerCase());
  }

  async hasCapability(companyId: string, capabilityId: string): Promise<boolean> {
    const capabilities = await this.getEffectiveCapabilities(companyId);
    return capabilities.includes(capabilityId.toLowerCase());
  }

  private toEntitlementDomain(record: any): CompanyEntitlement {
    return {
      id: record.id,
      companyId: record.companyId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      validFrom: record.validFrom,
      validUntil: record.validUntil ?? undefined,
      isActive: record.isActive,
      items: record.items.map((item: any) => ({
        id: item.id,
        entitlementId: item.entitlementId,
        itemType: item.itemType,
        itemKey: item.itemKey,
        createdAt: item.createdAt,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export class PrismaBundleItemRepository implements IBundleItemRepository {
  constructor(private prisma: PrismaClient) {}

  async getByBundleId(bundleId: string): Promise<BundleItem[]> {
    const records = await this.prisma.bundleItem.findMany({
      where: { bundleId },
    });
    return records.map((r) => ({
      id: r.id,
      bundleId: r.bundleId,
      itemType: r.itemType as 'module' | 'capability',
      itemKey: r.itemKey,
      createdAt: r.createdAt,
    }));
  }

  async getModuleKeysByBundleId(bundleId: string): Promise<string[]> {
    const records = await this.prisma.bundleItem.findMany({
      where: { bundleId, itemType: 'module' },
    });
    return records.map((r) => r.itemKey);
  }

  async getCapabilityKeysByBundleId(bundleId: string): Promise<string[]> {
    const records = await this.prisma.bundleItem.findMany({
      where: { bundleId, itemType: 'capability' },
    });
    return records.map((r) => r.itemKey);
  }

  async addItem(bundleId: string, item: Omit<BundleItem, 'id' | 'bundleId' | 'createdAt'>): Promise<void> {
    await this.prisma.bundleItem.create({
      data: {
        bundleId,
        itemType: item.itemType,
        itemKey: item.itemKey,
      },
    });
  }

  async removeItem(bundleId: string, itemKey: string): Promise<void> {
    await this.prisma.bundleItem.deleteMany({
      where: { bundleId, itemKey },
    });
  }

  async clearItems(bundleId: string): Promise<void> {
    await this.prisma.bundleItem.deleteMany({
      where: { bundleId },
    });
  }
}

export class PrismaBundleRegistryRepository implements IBundleItemRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<BundleDefinition[]> {
    const records = await this.prisma.bundleRegistry.findMany({
      include: { bundleItems: true },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toBundleDomain(r));
  }

  async getById(id: string): Promise<BundleDefinition | null> {
    const record = await this.prisma.bundleRegistry.findUnique({
      where: { id },
      include: { bundleItems: true },
    });
    if (!record) return null;
    return this.toBundleDomain(record);
  }

  async getByCode(code: string): Promise<BundleDefinition | null> {
    const record = await this.prisma.bundleRegistry.findUnique({
      where: { code },
      include: { bundleItems: true },
    });
    if (!record) return null;
    return this.toBundleDomain(record);
  }

  async create(bundle: BundleDefinition): Promise<void> {
    await this.prisma.bundleRegistry.create({
      data: {
        id: bundle.id,
        code: bundle.code,
        name: bundle.name,
        description: bundle.description,
        lifecycleStatus: bundle.lifecycleStatus,
        modules: bundle.items.filter((i) => i.itemType === 'module').map((i) => i.itemKey),
      },
    });
  }

  async update(id: string, bundle: Partial<BundleDefinition>): Promise<void> {
    const updateData: Prisma.BundleRegistryUncheckedUpdateInput = { updatedAt: new Date() };
    if (bundle.name) updateData.name = bundle.name;
    if (bundle.description) updateData.description = bundle.description;
    if (bundle.lifecycleStatus) updateData.lifecycleStatus = bundle.lifecycleStatus;

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

  async getReady(): Promise<BundleDefinition[]> {
    const records = await this.prisma.bundleRegistry.findMany({
      where: { lifecycleStatus: 'ready' },
      include: { bundleItems: true },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toBundleDomain(r));
  }

  async getByBundleId(bundleId: string): Promise<BundleItem[]> {
    const records = await this.prisma.bundleItem.findMany({
      where: { bundleId },
    });
    return records.map((r) => ({
      id: r.id,
      bundleId: r.bundleId,
      itemType: r.itemType as 'module' | 'capability',
      itemKey: r.itemKey,
      createdAt: r.createdAt,
    }));
  }

  async getModuleKeysByBundleId(bundleId: string): Promise<string[]> {
    const records = await this.prisma.bundleItem.findMany({
      where: { bundleId, itemType: 'module' },
    });
    return records.map((r) => r.itemKey);
  }

  async getCapabilityKeysByBundleId(bundleId: string): Promise<string[]> {
    const records = await this.prisma.bundleItem.findMany({
      where: { bundleId, itemType: 'capability' },
    });
    return records.map((r) => r.itemKey);
  }

  async addItem(bundleId: string, item: Omit<BundleItem, 'id' | 'bundleId' | 'createdAt'>): Promise<void> {
    await this.prisma.bundleItem.create({
      data: {
        bundleId,
        itemType: item.itemType,
        itemKey: item.itemKey,
      },
    });
  }

  async removeItem(bundleId: string, itemKey: string): Promise<void> {
    await this.prisma.bundleItem.deleteMany({
      where: { bundleId, itemKey },
    });
  }

  async clearItems(bundleId: string): Promise<void> {
    await this.prisma.bundleItem.deleteMany({
      where: { bundleId },
    });
  }

  private toBundleDomain(record: any): BundleDefinition {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description ?? undefined,
      lifecycleStatus: record.lifecycleStatus as 'draft' | 'ready' | 'deprecated' | 'inactive',
      items: (record.bundleItems || []).map((item: any) => ({
        id: item.id,
        bundleId: item.bundleId,
        itemType: item.itemType,
        itemKey: item.itemKey,
        createdAt: item.createdAt,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}