import { PrismaBundleRegistryRepository } from '../PrismaBundleRegistryRepository';

describe('PrismaBundleRegistryRepository', () => {
  it('rewrites normalized BundleItem rows from modulesIncluded and capabilities on update', async () => {
    const tx = {
      bundleRegistry: { update: jest.fn() },
      bundleItem: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      bundleRegistry: {
        findUnique: jest.fn().mockResolvedValue({ pricing: { amount: 10 } }),
      },
      bundleItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const repo = new PrismaBundleRegistryRepository(prisma as any);

    await repo.update('bundle_crm', {
      modulesIncluded: ['crm'],
      capabilities: ['crm.smartScoring'],
      businessDomains: ['service'],
    });

    expect(tx.bundleRegistry.update).toHaveBeenCalledWith({
      where: { id: 'bundle_crm' },
      data: expect.objectContaining({
        modules: ['crm'],
        pricing: { amount: 10, businessDomains: ['service'] },
      }),
    });
    expect(tx.bundleItem.deleteMany).toHaveBeenCalledWith({ where: { bundleId: 'bundle_crm' } });
    expect(tx.bundleItem.create).toHaveBeenCalledWith({
      data: {
        id: 'bi_bundle_crm_module_crm',
        bundleId: 'bundle_crm',
        itemType: 'module',
        itemKey: 'crm',
      },
    });
    expect(tx.bundleItem.create).toHaveBeenCalledWith({
      data: {
        id: 'bi_bundle_crm_capability_crm.smartScoring',
        bundleId: 'bundle_crm',
        itemType: 'capability',
        itemKey: 'crm.smartScoring',
      },
    });
  });

  it('preserves existing module items when only capabilities are updated', async () => {
    const tx = {
      bundleRegistry: { update: jest.fn() },
      bundleItem: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      bundleRegistry: {
        findUnique: jest.fn(),
      },
      bundleItem: {
        findMany: jest.fn().mockResolvedValue([
          { itemType: 'module', itemKey: 'crm' },
          { itemType: 'capability', itemKey: 'crm.oldFeature' },
        ]),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const repo = new PrismaBundleRegistryRepository(prisma as any);

    await repo.update('bundle_crm', {
      capabilities: ['crm.smartScoring'],
    });

    expect(tx.bundleItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        itemType: 'module',
        itemKey: 'crm',
      }),
    }));
    expect(tx.bundleItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        itemType: 'capability',
        itemKey: 'crm.smartScoring',
      }),
    }));
    expect(tx.bundleItem.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        itemKey: 'crm.oldFeature',
      }),
    }));
  });
});
