import { PrismaClient, Prisma } from '@prisma/client';
import {
  PromotionRule,
  BuyXGetYConfig,
  ThresholdDiscountConfig,
} from '../../../../domain/sales/entities/PromotionRule';
import {
  IPromotionRuleRepository,
  PromotionRuleListOptions,
} from '../../../../repository/interfaces/sales/IPromotionRuleRepository';

export class PrismaPromotionRuleRepository implements IPromotionRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): PromotionRule {
    return new PromotionRule({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description ?? undefined,
      type: row.type,
      status: row.status,
      priority: row.priority,
      validFrom: row.validFrom ?? undefined,
      validTo: row.validTo ?? undefined,
      scope: row.scope,
      itemIds: row.itemIds ?? [],
      categoryIds: row.categoryIds ?? [],
      buyXGetY: row.buyXGetY != null ? (row.buyXGetY as BuyXGetYConfig) : undefined,
      thresholdDiscount:
        row.thresholdDiscount != null
          ? (row.thresholdDiscount as ThresholdDiscountConfig)
          : undefined,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(rule: PromotionRule, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).promotionRule.create({
      data: {
        id: rule.id,
        companyId: rule.companyId,
        name: rule.name,
        description: rule.description ?? null,
        type: rule.type,
        status: rule.status,
        priority: rule.priority,
        validFrom: rule.validFrom ?? null,
        validTo: rule.validTo ?? null,
        scope: rule.scope,
        itemIds: rule.itemIds,
        categoryIds: rule.categoryIds,
        buyXGetY: rule.buyXGetY != null ? (rule.buyXGetY as unknown as Prisma.InputJsonValue) : undefined,
        thresholdDiscount:
          rule.thresholdDiscount != null ? (rule.thresholdDiscount as unknown as Prisma.InputJsonValue) : undefined,
        createdBy: rule.createdBy,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      },
    });
  }

  async update(rule: PromotionRule, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).promotionRule.update({
      where: { id: rule.id },
      data: {
        name: rule.name,
        description: rule.description ?? null,
        type: rule.type,
        status: rule.status,
        priority: rule.priority,
        validFrom: rule.validFrom ?? null,
        validTo: rule.validTo ?? null,
        scope: rule.scope,
        itemIds: rule.itemIds,
        categoryIds: rule.categoryIds,
        buyXGetY: rule.buyXGetY != null ? (rule.buyXGetY as unknown as Prisma.InputJsonValue) : undefined,
        thresholdDiscount:
          rule.thresholdDiscount != null ? (rule.thresholdDiscount as unknown as Prisma.InputJsonValue) : undefined,
        updatedAt: rule.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PromotionRule | null> {
    const row = await (this.prisma).promotionRule.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: PromotionRuleListOptions): Promise<PromotionRule[]> {
    const where: Prisma.PromotionRuleWhereInput = { companyId };
    if (opts?.status) {
      where.status = opts.status;
    } else if (!opts?.includeInactive) {
      where.status = 'ACTIVE';
    }
    if (opts?.type) where.type = opts.type;

    const rows = await (this.prisma).promotionRule.findMany({
      where,
      orderBy: { priority: 'asc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).promotionRule.deleteMany({
      where: { id, companyId },
    });
  }
}
