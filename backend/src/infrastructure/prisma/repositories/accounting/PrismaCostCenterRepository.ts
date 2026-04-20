import { PrismaClient } from '@prisma/client';
import { ICostCenterRepository } from '../../../../repository/interfaces/accounting/ICostCenterRepository';
import { CostCenter, CostCenterStatus } from '../../../../domain/accounting/entities/CostCenter';

export class PrismaCostCenterRepository implements ICostCenterRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<CostCenter[]> {
    const records = await this.prisma.costCenter.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findById(companyId: string, id: string): Promise<CostCenter | null> {
    const record = await this.prisma.costCenter.findFirst({
      where: { id, companyId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByCode(companyId: string, code: string): Promise<CostCenter | null> {
    const record = await this.prisma.costCenter.findFirst({
      where: { companyId, code },
    });
    return record ? this.toDomain(record) : null;
  }

  async create(costCenter: CostCenter): Promise<CostCenter> {
    const record = await this.prisma.costCenter.create({
      data: {
        id: costCenter.id,
        companyId: costCenter.companyId,
        code: costCenter.code,
        name: costCenter.name,
        description: costCenter.description,
        parentId: costCenter.parentId,
        status: costCenter.status,
        createdBy: costCenter.createdBy,
        updatedBy: costCenter.updatedBy,
        createdAt: costCenter.createdAt,
        updatedAt: costCenter.updatedAt,
      },
    });
    return this.toDomain(record);
  }

  async update(costCenter: CostCenter): Promise<CostCenter> {
    const record = await this.prisma.costCenter.update({
      where: { id: costCenter.id },
      data: {
        code: costCenter.code,
        name: costCenter.name,
        description: costCenter.description,
        parentId: costCenter.parentId,
        status: costCenter.status,
        updatedBy: costCenter.updatedBy,
        updatedAt: costCenter.updatedAt,
      },
    });
    return this.toDomain(record);
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.costCenter.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): CostCenter {
    return new CostCenter(
      record.id,
      record.companyId,
      record.name,
      record.code,
      record.description ?? null,
      record.parentId ?? null,
      (record.status as CostCenterStatus) ?? CostCenterStatus.ACTIVE,
      record.createdAt,
      record.createdBy ?? '',
      record.updatedAt,
      record.updatedBy ?? ''
    );
  }
}
