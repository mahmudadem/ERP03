import { PrismaClient } from '@prisma/client';
import { ICompanyGroupRepository } from '../../../../repository/interfaces/accounting/ICompanyGroupRepository';
import { CompanyGroup, CompanyGroupMember } from '../../../../domain/accounting/entities/CompanyGroup';

export class PrismaCompanyGroupRepository implements ICompanyGroupRepository {
  constructor(private prisma: PrismaClient) {}

  async create(group: CompanyGroup): Promise<CompanyGroup> {
    const record = await this.prisma.companyGroup.create({
      data: {
        id: group.id,
        name: group.name,
        members: group.members as any,
        reportingCurrency: group.reportingCurrency,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: new Date(),
      } as any,
    });
    return this.toDomain(record);
  }

  async update(group: CompanyGroup): Promise<CompanyGroup> {
    const record = await this.prisma.companyGroup.update({
      where: { id: group.id },
      data: {
        name: group.name,
        members: group.members as any,
        reportingCurrency: group.reportingCurrency,
        updatedAt: new Date(),
      } as any,
    });
    return this.toDomain(record);
  }

  async list(companyId: string): Promise<CompanyGroup[]> {
    const records = await this.prisma.companyGroup.findMany({
      where: {
        OR: [
          { companyId },
        ],
      },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<CompanyGroup | null> {
    const record = await this.prisma.companyGroup.findUnique({
      where: { id },
    });
    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: any): CompanyGroup {
    const members: CompanyGroupMember[] = (record.members as any[]) ?? [];
    return new CompanyGroup(
      record.id,
      record.name,
      record.reportingCurrency ?? 'USD',
      members,
      record.createdAt,
      record.createdBy ?? ''
    );
  }
}
