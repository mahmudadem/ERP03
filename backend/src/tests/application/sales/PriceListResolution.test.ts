import { describe, expect, it, jest } from '@jest/globals';
import { PriceList } from '../../../domain/sales/entities/PriceList';
import {
  GetEffectivePriceUseCase,
} from '../../../application/sales/use-cases/PriceListUseCases';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-price-test';

/** Build a PriceList with tiers: minQty 1 → 100, 100 → 95, 1000 → 90 */
const makeTimeredList = (overrides: Partial<ConstructorParameters<typeof PriceList>[0]> = {}) =>
  new PriceList({
    companyId: COMPANY_ID,
    name: 'Retail USD',
    currency: 'USD',
    status: 'ACTIVE',
    isDefault: true,
    lines: [
      { itemId: 'ITEM-A', minQty: 1,    unitPrice: 100 },
      { itemId: 'ITEM-A', minQty: 100,  unitPrice: 95  },
      { itemId: 'ITEM-A', minQty: 1000, unitPrice: 90  },
    ],
    createdBy: 'u-test',
    ...overrides,
  });

// ---------------------------------------------------------------------------
// 1. getEffectiveLine — tier selection
// ---------------------------------------------------------------------------

describe('PriceList.getEffectiveLine — tiered pricing', () => {
  const list = makeTimeredList();

  it('qty 1 → tier at minQty 1 (price 100)', () => {
    expect(list.getEffectiveLine('ITEM-A', 1)?.unitPrice).toBe(100);
  });

  it('qty 50 → tier at minQty 1 (price 100)', () => {
    expect(list.getEffectiveLine('ITEM-A', 50)?.unitPrice).toBe(100);
  });

  it('qty 100 → tier at minQty 100 (price 95)', () => {
    expect(list.getEffectiveLine('ITEM-A', 100)?.unitPrice).toBe(95);
  });

  it('qty 999 → tier at minQty 100 (price 95)', () => {
    expect(list.getEffectiveLine('ITEM-A', 999)?.unitPrice).toBe(95);
  });

  it('qty 1000 → tier at minQty 1000 (price 90)', () => {
    expect(list.getEffectiveLine('ITEM-A', 1000)?.unitPrice).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// 2. getEffectiveLine — null cases
// ---------------------------------------------------------------------------

describe('PriceList.getEffectiveLine — null cases', () => {
  it('returns null for unmatched itemId', () => {
    const list = makeTimeredList();
    expect(list.getEffectiveLine('ITEM-UNKNOWN', 10)).toBeNull();
  });

  it('returns null when qty is below smallest minQty tier', () => {
    // List where smallest tier starts at minQty 5
    const list = new PriceList({
      companyId: COMPANY_ID,
      name: 'High MOQ',
      currency: 'USD',
      status: 'ACTIVE',
      isDefault: false,
      lines: [{ itemId: 'ITEM-B', minQty: 5, unitPrice: 50 }],
      createdBy: 'u-test',
    });
    expect(list.getEffectiveLine('ITEM-B', 3)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. isActiveOn
// ---------------------------------------------------------------------------

describe('PriceList.isActiveOn', () => {
  it('returns false when status is INACTIVE', () => {
    const list = makeTimeredList({ status: 'INACTIVE' });
    expect(list.isActiveOn(new Date('2026-06-01'))).toBe(false);
  });

  it('returns false when date is before validFrom', () => {
    const list = makeTimeredList({
      validFrom: new Date('2026-07-01'),
    });
    expect(list.isActiveOn(new Date('2026-06-30'))).toBe(false);
  });

  it('returns false when date is after validTo', () => {
    const list = makeTimeredList({
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-06-30'),
    });
    expect(list.isActiveOn(new Date('2026-07-01'))).toBe(false);
  });

  it('returns true when active and date is within window', () => {
    const list = makeTimeredList({
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-12-31'),
    });
    expect(list.isActiveOn(new Date('2026-06-15'))).toBe(true);
  });

  it('returns true when active and no date window set', () => {
    const list = makeTimeredList();
    expect(list.isActiveOn(new Date('2099-01-01'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Construction validation
// ---------------------------------------------------------------------------

describe('PriceList construction validation', () => {
  it('throws on duplicate (itemId, minQty)', () => {
    expect(() =>
      new PriceList({
        companyId: COMPANY_ID,
        name: 'Bad List',
        currency: 'USD',
        status: 'ACTIVE',
        isDefault: false,
        lines: [
          { itemId: 'ITEM-A', minQty: 1, unitPrice: 100 },
          { itemId: 'ITEM-A', minQty: 1, unitPrice: 90 }, // duplicate
        ],
        createdBy: 'u-test',
      })
    ).toThrow(/duplicate line.*ITEM-A.*minQty 1/i);
  });

  it('throws when currency length is not 3', () => {
    expect(() =>
      new PriceList({
        companyId: COMPANY_ID,
        name: 'Bad Currency',
        currency: 'US', // too short
        status: 'ACTIVE',
        isDefault: false,
        lines: [],
        createdBy: 'u-test',
      })
    ).toThrow(/currency must be exactly 3/i);
  });
});

// ---------------------------------------------------------------------------
// 5. GetEffectivePriceUseCase
// ---------------------------------------------------------------------------

const makePartyRepo = (priceListId?: string) => ({
  getById: jest.fn(async (_companyId: string, _id: string) =>
    ({
      id: 'cust-1',
      companyId: COMPANY_ID,
      defaultCurrency: 'USD',
      // The Party.defaultPriceListId override — only present when supplied
      ...(priceListId ? { defaultPriceListId: priceListId } : {}),
    } as any)
  ),
  getByCode: jest.fn(),
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('GetEffectivePriceUseCase', () => {
  it('falls back to default list when customer has no priceListId override and returns null when no default exists', async () => {
    const priceListRepo = {
      getById: jest.fn(async () => null),
      getDefaultForCurrency: jest.fn(async () => null),
      getByName: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const uc = new GetEffectivePriceUseCase(priceListRepo as any, makePartyRepo() as any);

    const result = await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'cust-1',
      itemId: 'ITEM-A',
      qty: 5,
    });

    // No override, no default → null
    expect(result).toBeNull();
    // Should have tried getDefaultForCurrency with USD (from party.defaultCurrency)
    expect((priceListRepo.getDefaultForCurrency as jest.Mock).mock.calls[0]).toEqual([COMPANY_ID, 'USD']);
  });

  it('returns unitPrice with sourcePriceListId when default list has a matching line', async () => {
    const defaultList = makeTimeredList(); // ITEM-A tiers, isDefault=true, active

    const priceListRepo = {
      getById: jest.fn(async () => null),
      getDefaultForCurrency: jest.fn(async (_companyId: string, currency: string) =>
        currency === 'USD' ? defaultList : null
      ),
      getByName: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const uc = new GetEffectivePriceUseCase(priceListRepo as any, makePartyRepo() as any);

    const result = await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'cust-1',
      itemId: 'ITEM-A',
      qty: 150, // → tier at minQty 100, price 95
    });

    expect(result).not.toBeNull();
    expect(result!.unitPrice).toBe(95);
    expect(result!.sourcePriceListId).toBe(defaultList.id);
    expect(result!.isDefault).toBe(true);
  });

  it('uses customer priceListId override when present and list is active', async () => {
    const overrideList = new PriceList({
      companyId: COMPANY_ID,
      name: 'VIP List',
      currency: 'USD',
      status: 'ACTIVE',
      isDefault: false,
      lines: [{ itemId: 'ITEM-A', minQty: 1, unitPrice: 80 }],
      createdBy: 'u-test',
    });

    const priceListRepo = {
      getById: jest.fn(async (_companyId: string, id: string) =>
        id === overrideList.id ? overrideList : null
      ),
      getDefaultForCurrency: jest.fn(async () => null),
      getByName: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const uc = new GetEffectivePriceUseCase(
      priceListRepo as any,
      makePartyRepo(overrideList.id) as any
    );

    const result = await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'cust-1',
      itemId: 'ITEM-A',
      qty: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.unitPrice).toBe(80);
    expect(result!.sourcePriceListId).toBe(overrideList.id);
    expect(result!.isDefault).toBe(false);
    // Should not have called getDefaultForCurrency because override was used
    expect(priceListRepo.getDefaultForCurrency).not.toHaveBeenCalled();
  });
});
