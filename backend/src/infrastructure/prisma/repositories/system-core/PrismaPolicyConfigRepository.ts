import { PrismaClient, Prisma } from '@prisma/client';
import { PolicyConfig } from '../../../../domain/system-core/entities/PolicyConfig';
import { IPolicyConfigRepository } from '../../../../repository/interfaces/system-core/IPolicyConfigRepository';

/**
 * PrismaPolicyConfigRepository
 *
 * SQL twin of FirestorePolicyConfigRepository. Applies the same shape-validation
 * guard before calling PolicyConfig.fromJSON — a malformed row must throw rather
 * than silently falling through to default-allow.
 */
export class PrismaPolicyConfigRepository implements IPolicyConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getConfig(companyId: string): Promise<PolicyConfig | null> {
    const row = await (this.prisma).policyConfig.findUnique({
      where: { companyId },
    });
    if (!row) return null;
    const data = row.rules !== undefined
      ? { companyId: row.companyId, rules: row.rules }
      : row;

    if (!isPolicyConfigShape(data)) {
      throw new Error(
        `PolicyConfig row for company ${companyId} is malformed: ${describeShapeProblem(data)}`
      );
    }
    return PolicyConfig.fromJSON(data);
  }

  async saveConfig(config: PolicyConfig, transaction?: unknown): Promise<void> {
    config.updatedAt = new Date();
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    const payload = config.toJSON();
    await (client).policyConfig.upsert({
      where: { companyId: config.companyId },
      create: {
        companyId: config.companyId,
        rules: payload.rules,
      },
      update: {
        rules: payload.rules,
      },
    });
  }
}

const isPolicyConfigShape = (data: any): boolean => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (typeof data.companyId !== 'string' || data.companyId.length === 0) return false;
  if (!Array.isArray(data.rules)) return false;
  return true;
};

const describeShapeProblem = (data: any): string => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return `payload is not an object (got ${Array.isArray(data) ? 'array' : typeof data})`;
  }
  if (typeof data.companyId !== 'string' || data.companyId.length === 0) {
    return `companyId is missing or not a non-empty string (got ${typeof data.companyId})`;
  }
  if (!Array.isArray(data.rules)) {
    return `rules is not an array (got ${typeof data.rules})`;
  }
  return 'unknown shape problem';
};
