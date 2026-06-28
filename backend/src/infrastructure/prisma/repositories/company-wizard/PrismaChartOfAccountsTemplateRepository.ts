import { PrismaClient } from '@prisma/client';
import { IChartOfAccountsTemplateRepository } from '../../../../repository/interfaces/company-wizard/IChartOfAccountsTemplateRepository';

export class PrismaChartOfAccountsTemplateRepository implements IChartOfAccountsTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async listChartOfAccountsTemplates(): Promise<Array<{ id: string; name: string; code?: string }>> {
    const records = await this.prisma.chartOfAccountsTemplate.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    return records.map((record) => ({
      id: record.id,
      code: record.code || undefined,
      name: record.name,
    }));
  }
}
