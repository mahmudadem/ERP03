import { PrismaClient } from '@prisma/client';
import { IChartOfAccountsTemplateRepository } from '../../../../repository/interfaces/company-wizard/IChartOfAccountsTemplateRepository';

export class PrismaChartOfAccountsTemplateRepository implements IChartOfAccountsTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async listChartOfAccountsTemplates(): Promise<Array<{ id: string; name: string }>> {
    const records = await this.prisma.chartOfAccountsTemplate.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    return records;
  }
}
