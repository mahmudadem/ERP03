import { Prisma, PrismaClient } from '@prisma/client';
import { ITaxCodeRepository, TaxCodeListOptions } from '../../../../repository/interfaces/shared/ITaxCodeRepository';
import { TaxCode, TaxType, TaxScope } from '../../../../domain/shared/entities/TaxCode';

export class PrismaTaxCodeRepository implements ITaxCodeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(taxCode: TaxCode): Promise<void> {
    await this.prisma.taxCode.create({
      data: {
        id: taxCode.id,
        companyId: taxCode.companyId,
        code: taxCode.code,
        name: taxCode.name,
        rate: taxCode.rate,
        type: taxCode.taxType,
        scope: taxCode.scope,
        purchaseTaxAccountId: taxCode.purchaseTaxAccountId || null,
        salesTaxAccountId: taxCode.salesTaxAccountId || null,
        purchaseTaxTreatment: taxCode.purchaseTaxTreatment,
        priceIsInclusive: taxCode.priceIsInclusive,
        isActive: taxCode.active,
        createdAt: taxCode.createdAt,
        updatedAt: taxCode.updatedAt,
      },
    });
  }

  async update(taxCode: TaxCode): Promise<void> {
    await this.prisma.taxCode.update({
      where: { id: taxCode.id },
      data: {
        code: taxCode.code,
        name: taxCode.name,
        rate: taxCode.rate,
        type: taxCode.taxType,
        scope: taxCode.scope,
        purchaseTaxAccountId: taxCode.purchaseTaxAccountId || null,
        salesTaxAccountId: taxCode.salesTaxAccountId || null,
        purchaseTaxTreatment: taxCode.purchaseTaxTreatment,
        priceIsInclusive: taxCode.priceIsInclusive,
        isActive: taxCode.active,
        updatedAt: taxCode.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<TaxCode | null> {
    const record = await this.prisma.taxCode.findFirst({
      where: { id, companyId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByCode(companyId: string, code: string): Promise<TaxCode | null> {
    const record = await this.prisma.taxCode.findFirst({
      where: { companyId, code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: TaxCodeListOptions): Promise<TaxCode[]> {
    const where: Prisma.TaxCodeWhereInput = { companyId };
    if (opts?.scope) {
      where.scope = opts.scope;
    }
    if (opts?.active !== undefined) {
      where.isActive = opts.active;
    }

    const records = await this.prisma.taxCode.findMany({
      where,
      orderBy: { code: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });

    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): TaxCode {
    return new TaxCode({
      id: record.id,
      companyId: record.companyId,
      code: record.code,
      name: record.name,
      rate: record.rate,
      taxType: record.type as TaxType,
      scope: (record.scope || 'BOTH') as TaxScope,
      purchaseTaxAccountId: record.purchaseTaxAccountId || undefined,
      salesTaxAccountId: record.salesTaxAccountId || undefined,
      purchaseTaxTreatment: record.purchaseTaxTreatment || 'RECOVERABLE',
      priceIsInclusive: record.priceIsInclusive === true,
      active: record.isActive,
      createdBy: 'SYSTEM',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
