import { PrismaClient } from '@prisma/client';
import { IInventoryTemplateRepository } from '../../../../repository/interfaces/company-wizard/IInventoryTemplateRepository';

export class PrismaInventoryTemplateRepository implements IInventoryTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async listInventoryTemplates(): Promise<Array<{ id: string; name: string }>> {
    const records = await this.prisma.inventoryTemplate.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    return records;
  }
}
