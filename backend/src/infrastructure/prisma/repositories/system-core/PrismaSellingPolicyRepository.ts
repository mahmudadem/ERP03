import { PrismaClient, Prisma } from '@prisma/client';
import { SellingPolicy } from '../../../../domain/system-core/entities/SellingPolicy';
import { ISellingPolicyRepository } from '../../../../repository/interfaces/system-core/ISellingPolicyRepository';

export class PrismaSellingPolicyRepository implements ISellingPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPolicy(companyId: string): Promise<SellingPolicy | null> {
    const row = await (this.prisma as any).sellingPolicy.findUnique({
      where: { companyId },
    });
    if (!row) return null;
    return SellingPolicy.fromJSON({
      companyId: row.companyId,
      belowCostMode: row.belowCostMode,
      minMarginPercent: row.minMarginPercent ?? undefined,
      allowManagerOverride: row.allowManagerOverride,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async savePolicy(policy: SellingPolicy, transaction?: unknown): Promise<void> {
    policy.updatedAt = new Date();
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    const payload = policy.toJSON();
    await (client as any).sellingPolicy.upsert({
      where: { companyId: policy.companyId },
      create: {
        companyId: policy.companyId,
        belowCostMode: payload.belowCostMode ?? 'REQUIRE_APPROVAL',
        minMarginPercent: payload.minMarginPercent ?? null,
        allowManagerOverride: payload.allowManagerOverride ?? true,
      },
      update: {
        belowCostMode: payload.belowCostMode ?? 'REQUIRE_APPROVAL',
        minMarginPercent: payload.minMarginPercent ?? null,
        allowManagerOverride: payload.allowManagerOverride ?? true,
      },
    });
  }
}
