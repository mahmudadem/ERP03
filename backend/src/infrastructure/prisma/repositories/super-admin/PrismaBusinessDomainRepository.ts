import { PrismaClient } from '@prisma/client';
import { IBusinessDomainRepository } from '../../../../repository/interfaces/super-admin/IBusinessDomainRepository';
import { BusinessDomainDefinition } from '../../../../domain/super-admin/BusinessDomainDefinition';

export class PrismaBusinessDomainRepository implements IBusinessDomainRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<BusinessDomainDefinition[]> {
    const records = await this.prisma.businessDomain.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(id: string): Promise<BusinessDomainDefinition | null> {
    const record = await this.prisma.businessDomain.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(domain: BusinessDomainDefinition): Promise<void> {
    await this.prisma.businessDomain.create({
      data: {
        id: domain.id,
        code: domain.id,
        name: domain.name,
        description: domain.description,
        createdAt: domain.createdAt,
        updatedAt: domain.updatedAt,
      },
    });
  }

  async update(id: string, domain: Partial<BusinessDomainDefinition>): Promise<void> {
    await this.prisma.businessDomain.update({
      where: { id },
      data: {
        name: domain.name,
        description: domain.description,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.businessDomain.delete({
      where: { id },
    });
  }

  private toDomain(record: any): BusinessDomainDefinition {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
