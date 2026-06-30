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
        translations: uom.translations,
        baseUomId: null,
        conversionFactor: 1.0,
        createdAt: uom.createdAt,
        updatedAt: uom.updatedAt,
        ...(uom).dimension !== undefined && { dimension: (uom).dimension },
        ...(uom).decimalPlaces !== undefined && { decimalPlaces: (uom).decimalPlaces },
        ...(uom).active !== undefined && { active: (uom).active },
        ...(uom).isSystem !== undefined && { isSystem: (uom).isSystem },
        ...(uom).createdBy !== undefined && { createdBy: (uom).createdBy },
      },
    });
  }

  async updateUom(id: string, data: Partial<Uom>): Promise<void> {
    await this.prisma.uom.update({
      where: { id },
      data: data,
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
      translations: record.translations ?? {},
      dimension: (record).dimension ?? 'OTHER',
      decimalPlaces: (record).decimalPlaces ?? 0,
      active: (record).active ?? true,
      isSystem: (record).isSystem ?? false,
      createdBy: (record).createdBy ?? 'SYSTEM',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
