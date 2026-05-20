import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Party } from '../../../domain/shared/entities/Party';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-party-test';

const makeParty = (overrides: Partial<ConstructorParameters<typeof Party>[0]> = {}) =>
  new Party({
    id: 'party-1',
    companyId: COMPANY_ID,
    code: 'CUST-001',
    legalName: 'Test Customer Ltd',
    displayName: 'Test Customer',
    roles: ['CUSTOMER'],
    active: true,
    createdBy: 'u-test',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

// ---------------------------------------------------------------------------
// 1. creditLimit validation — negative value
// ---------------------------------------------------------------------------

describe('Party.creditLimit validation', () => {
  it('throws when creditLimit is negative', () => {
    expect(() =>
      makeParty({
        creditLimit: -10,
      })
    ).toThrow('Party creditLimit must be >= 0');
  });

  it('accepts creditLimit of 0', () => {
    const party = makeParty({ creditLimit: 0 });
    expect(party.creditLimit).toBe(0);
  });

  it('accepts positive creditLimit', () => {
    const party = makeParty({ creditLimit: 100 });
    expect(party.creditLimit).toBe(100);
  });

  it('accepts large creditLimit values', () => {
    const party = makeParty({ creditLimit: 99999 });
    expect(party.creditLimit).toBe(99999);
  });

  it('accepts undefined creditLimit (backward-compatible)', () => {
    const party = makeParty({ creditLimit: undefined });
    expect(party.creditLimit).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. creditHoldPolicy validation — invalid value
// ---------------------------------------------------------------------------

describe('Party.creditHoldPolicy validation', () => {
  it('throws when creditHoldPolicy is invalid', () => {
    expect(() =>
      makeParty({
        creditHoldPolicy: 'STRICT' as any,
      })
    ).toThrow('Party creditHoldPolicy must be NONE, WARN, or BLOCK');
  });

  it('accepts creditHoldPolicy NONE', () => {
    const party = makeParty({ creditHoldPolicy: 'NONE' });
    expect(party.creditHoldPolicy).toBe('NONE');
  });

  it('accepts creditHoldPolicy WARN', () => {
    const party = makeParty({ creditHoldPolicy: 'WARN' });
    expect(party.creditHoldPolicy).toBe('WARN');
  });

  it('accepts creditHoldPolicy BLOCK', () => {
    const party = makeParty({ creditHoldPolicy: 'BLOCK' });
    expect(party.creditHoldPolicy).toBe('BLOCK');
  });

  it('accepts undefined creditHoldPolicy (backward-compatible)', () => {
    const party = makeParty({ creditHoldPolicy: undefined });
    expect(party.creditHoldPolicy).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. defaultPriceListId — accepts any non-null string
// ---------------------------------------------------------------------------

describe('Party.defaultPriceListId', () => {
  it('accepts defaultPriceListId reference', () => {
    const party = makeParty({ defaultPriceListId: 'pricelist-vip-1' });
    expect(party.defaultPriceListId).toBe('pricelist-vip-1');
  });

  it('accepts undefined defaultPriceListId (backward-compatible)', () => {
    const party = makeParty({ defaultPriceListId: undefined });
    expect(party.defaultPriceListId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. toJSON includes all three fields
// ---------------------------------------------------------------------------

describe('Party.toJSON includes credit settings fields', () => {
  it('includes creditLimit, creditHoldPolicy, defaultPriceListId when set', () => {
    const party = makeParty({
      creditLimit: 50000,
      creditHoldPolicy: 'WARN',
      defaultPriceListId: 'pricelist-1',
    });

    const json = party.toJSON();
    expect(json.creditLimit).toBe(50000);
    expect(json.creditHoldPolicy).toBe('WARN');
    expect(json.defaultPriceListId).toBe('pricelist-1');
  });

  it('includes fields as undefined when not set', () => {
    const party = makeParty();

    const json = party.toJSON();
    expect(json.creditLimit).toBeUndefined();
    expect(json.creditHoldPolicy).toBeUndefined();
    expect(json.defaultPriceListId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. fromJSON round-trip
// ---------------------------------------------------------------------------

describe('Party.fromJSON round-trip', () => {
  it('preserves creditLimit through round-trip', () => {
    const original = makeParty({ creditLimit: 75000 });
    const json = original.toJSON();
    const restored = Party.fromJSON(json);

    expect(restored.creditLimit).toBe(75000);
  });

  it('preserves creditHoldPolicy through round-trip', () => {
    const original = makeParty({ creditHoldPolicy: 'BLOCK' });
    const json = original.toJSON();
    const restored = Party.fromJSON(json);

    expect(restored.creditHoldPolicy).toBe('BLOCK');
  });

  it('preserves defaultPriceListId through round-trip', () => {
    const original = makeParty({ defaultPriceListId: 'pricelist-retail-usd' });
    const json = original.toJSON();
    const restored = Party.fromJSON(json);

    expect(restored.defaultPriceListId).toBe('pricelist-retail-usd');
  });

  it('round-trips all three fields together', () => {
    const original = makeParty({
      creditLimit: 100000,
      creditHoldPolicy: 'WARN',
      defaultPriceListId: 'pricelist-vip',
    });

    const json = original.toJSON();
    const restored = Party.fromJSON(json);

    expect(restored.creditLimit).toBe(100000);
    expect(restored.creditHoldPolicy).toBe('WARN');
    expect(restored.defaultPriceListId).toBe('pricelist-vip');
  });

  it('round-trips with fields undefined', () => {
    const original = makeParty();
    const json = original.toJSON();
    const restored = Party.fromJSON(json);

    expect(restored.creditLimit).toBeUndefined();
    expect(restored.creditHoldPolicy).toBeUndefined();
    expect(restored.defaultPriceListId).toBeUndefined();
  });
});
