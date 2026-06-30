import { PrismaClient, Prisma } from '@prisma/client';
import { POSPolicy } from '../../../../domain/pos/entities/POSPolicy';
import { IPosPolicyRepository } from '../../../../repository/interfaces/pos/IPosPolicyRepository';

export class PrismaPosPolicyRepository implements IPosPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPolicy(companyId: string): Promise<POSPolicy | null> {
    const record = await this.prisma.posPolicy.findUnique({ where: { companyId } });
    if (!record) return null;
    return POSPolicy.fromJSON({
      ...((record.policy as object) || {}),
      companyId: record.companyId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async savePolicy(policy: POSPolicy, tx?: unknown): Promise<void> {
    policy.updatedAt = new Date();
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posPolicy.upsert({
      where: { companyId: policy.companyId },
      create: {
        companyId: policy.companyId,
        policy: policy.toJSON(),
      },
      update: {
        policy: policy.toJSON(),
        updatedAt: new Date(),
      },
    });
  }
}