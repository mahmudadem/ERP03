import { PrismaSystemMetadataRepository } from '../PrismaSystemMetadataRepository';

describe('PrismaSystemMetadataRepository', () => {
  it('hydrates COA template metadata from chart_of_accounts_templates for initialization', async () => {
    const prisma = {
      systemMetadata: {
        findUnique: jest.fn().mockResolvedValue({
          key: 'coa_templates',
          value: [
            {
              id: 'standard',
              name: 'Manifest Standard',
              complexity: 'medium',
              accountCount: null,
            },
          ],
        }),
      },
      chartOfAccountsTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'standard',
            name: 'Standard (Recommended)',
            industry: null,
            isDefault: true,
            accounts: [
              { code: '10000', name: 'Assets', type: 'asset' },
              { code: '10100', name: 'Cash', classification: 'asset' },
            ],
          },
        ]),
      },
    };
    const repo = new PrismaSystemMetadataRepository(prisma as any);

    const templates = await repo.getMetadata('coa_templates');

    expect(templates).toEqual([
      expect.objectContaining({
        id: 'standard',
        code: 'standard',
        name: 'Standard (Recommended)',
        complexity: 'medium',
        accountCount: 2,
        isDefault: true,
        accounts: [
          { code: '10000', name: 'Assets', type: 'ASSET', classification: 'ASSET' },
          { code: '10100', name: 'Cash', type: 'ASSET', classification: 'ASSET' },
        ],
      }),
    ]);
  });

  it('keeps non-COA metadata on the system_metadata table path', async () => {
    const prisma = {
      systemMetadata: {
        findUnique: jest.fn().mockResolvedValue({
          key: 'currencies',
          value: [{ code: 'USD' }],
        }),
        upsert: jest.fn(),
      },
      chartOfAccountsTemplate: {
        findMany: jest.fn(),
      },
    };
    const repo = new PrismaSystemMetadataRepository(prisma as any);

    await expect(repo.getMetadata('currencies')).resolves.toEqual([{ code: 'USD' }]);
    expect(prisma.chartOfAccountsTemplate.findMany).not.toHaveBeenCalled();
  });
});
