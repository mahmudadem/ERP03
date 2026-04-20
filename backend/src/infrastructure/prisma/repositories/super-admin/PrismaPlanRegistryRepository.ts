import { PrismaClient } from '@prisma/client';
import { IPlanRegistryRepository } from '../../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { PlanDefinition } from '../../../../domain/super-admin/PlanDefinition';

export class PrismaPlanRegistryRepository implements IPlanRegistryRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<PlanDefinition[]> {
    const records = await this.prisma.planRegistry.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(id: string): Promise<PlanDefinition | null> {
    const record = await this.prisma.planRegistry.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(plan: PlanDefinition): Promise<void> {
    await this.prisma.planRegistry.create({
      data: {
        id: plan.id,
        code: plan.id,
        name: plan.name,
        description: plan.description,
        pricing: { price: plan.price } as any,
        limits: plan.limits as any,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
  }

  async update(id: string, plan: Partial<PlanDefinition>): Promise<void> {
    const updateData: any = {};
    if (plan.name !== undefined) updateData.name = plan.name;
    if (plan.description !== undefined) updateData.description = plan.description;
    if (plan.price !== undefined) updateData.pricing = { price: plan.price } as any;
    if (plan.limits !== undefined) updateData.limits = plan.limits as any;
    if (plan.status !== undefined) updateData.features = { status: plan.status } as any;
    updateData.updatedAt = new Date();

    await this.prisma.planRegistry.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.planRegistry.delete({
      where: { id },
    });
  }

  private toDomain(record: any): PlanDefinition {
    const pricing = record.pricing as any;
    const limits = record.limits as any;
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      price: pricing?.price ?? 0,
      status: 'active',
      limits: limits ?? {
        maxCompanies: 0,
        maxUsersPerCompany: 0,
        maxModulesAllowed: 0,
        maxStorageMB: 0,
        maxTransactionsPerMonth: 0,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
