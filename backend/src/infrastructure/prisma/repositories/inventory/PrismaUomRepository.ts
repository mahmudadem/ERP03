import { PrismaClient } from '@prisma/client';
import { IUomRepository, UomListOptions } from '../../../../repository/interfaces/inventory/IUomRepository';
import { Uom } from '../../../../domain/inventory/entities/Uom';

export class PrismaUomRepository implements IUomRepository {
  constructor(private prisma: PrismaClient) {}

  async createUom(uom: Uom): Promise<void> {
    await this.prisma.uom.create({
      data: {
        id: uom.id,
        companyId: uom.companyId,
        code: uom.code,
        name: uom.name,
        baseUomId: null,
        conversionFactor: 1.0,
        createdAt: uom.createdAt,
        updatedAt: uom.updatedAt,
        ...(uom as any).dimension !== undefined && { dimension: (uom as any).dimension },
        ...(uom as any).decimalPlaces !== undefined && { decimalPlaces: (uom as any).decimalPlaces },
        ...(uom as any).active !== undefined && { active: (uom as any).active },
        ...(uom as any).isSystem !== undefined && { isSystem: (uom as any).isSystem },
        ...(uom as any).createdBy !== undefined && { createdBy: (uom as any).createdBy },
      } as any,
    });
  }

  async updateUom(id: string, data: Partial<Uom>): Promise<void> {
    await this.prisma.uom.update({
      where: { id },
      data: data as any,
    });
  }

  async getUom(id: string): Promise<Uom | null> {
    const record = await this.prisma.uom.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyUoms(companyId: string, opts?: UomListOptions): Promise<Uom[]> {
    const where: any = { companyId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    const records = await this.prisma.uom.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getUomByCode(companyId: string, code: string): Promise<Uom | null> {
    const record = await this.prisma.uom.findFirst({
      where: { companyId, code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  private toDomain(record: any): Uom {
    return new Uom({
      id: record.id,
      companyId: record.companyId,
      code: record.code,
      name: record.name,
      dimension: (record as any).dimension ?? 'OTHER',
      decimalPlaces: (record as any).decimalPlaces ?? 0,
      active: (record as any).active ?? true,
      isSystem: (record as any).isSystem ?? false,
      createdBy: (record as any).createdBy ?? 'SYSTEM',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
