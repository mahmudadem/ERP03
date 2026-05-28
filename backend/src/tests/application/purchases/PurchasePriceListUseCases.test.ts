import { describe, expect, it, jest } from '@jest/globals';
import { PurchasePriceList } from '../../../domain/purchases/entities/PurchasePriceList';
import {
  CreatePurchasePriceListUseCase,
  UpdatePurchasePriceListUseCase,
  DeletePurchasePriceListUseCase,
  GetEffectivePurchasePriceUseCase,
} from '../../../application/purchases/use-cases/PurchasePriceListUseCases';
import { IPurchasePriceListRepository } from '../../../repository/interfaces/purchases/IPurchasePriceListRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { Party } from '../../../domain/shared/entities/Party';

const COMPANY_ID = 'co-test-price-list';

const makeList = (overrides: Partial<ConstructorParameters<typeof PurchasePriceList>[0]> = {}) =>
  new PurchasePriceList({
    companyId: COMPANY_ID,
    name: 'Standard USD',
    currency: 'USD',
    status: 'ACTIVE',
    isDefault: true,
    lines: [
      { itemId: 'ITEM-A', minQty: 1, unitPrice: 100 },
      { itemId: 'ITEM-A', minQty: 10, unitPrice: 95 },
      { itemId: 'ITEM-A', minQty: 100, unitPrice: 90 },
    ],
    createdBy: 'u-test',
    ...overrides,
  });

const makeVendor = (overrides: Partial<ConstructorParameters<typeof Party>[0]> = {}) =>
  new Party({
    id: 'vendor-1',
    companyId: COMPANY_ID,
    code: 'SUP-001',
    legalName: 'Test Vendor LLC',
    displayName: 'Test Vendor',
    roles: ['VENDOR'],
    active: true,
    defaultCurrency: 'USD',
    createdBy: 'u-test',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makePriceListRepo = (overrides: Partial<IPurchasePriceListRepository> = {}): jest.Mocked<IPurchasePriceListRepository> => ({
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
  getByName: jest.fn(),
  list: jest.fn(),
  getDefaultForCurrency: jest.fn(),
  delete: jest.fn(),
  ...overrides,
} as any);

const makePartyRepo = (overrides: Partial<IPartyRepository> = {}): jest.Mocked<IPartyRepository> => ({
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
  getByCode: jest.fn(),
  list: jest.fn(),
  delete: jest.fn(),
  ...overrides,
} as any);

const makeTxManager = () => ({
  runTransaction: jest.fn(async (cb: (txn: any) => Promise<any>) => cb('mock-txn')),
});

describe('PurchasePriceList Domain Entity', () => {
  describe('getEffectiveLine — tiered pricing resolution', () => {
    const list = makeList();

    it('qty 1 → resolves to tier minQty 1 (price 100)', () => {
      expect(list.getEffectiveLine('ITEM-A', 1)?.unitPrice).toBe(100);
    });

    it('qty 5 → resolves to tier minQty 1 (price 100)', () => {
      expect(list.getEffectiveLine('ITEM-A', 5)?.unitPrice).toBe(100);
    });

    it('qty 10 → resolves to tier minQty 10 (price 95)', () => {
      expect(list.getEffectiveLine('ITEM-A', 10)?.unitPrice).toBe(95);
    });

    it('qty 50 → resolves to tier minQty 10 (price 95)', () => {
      expect(list.getEffectiveLine('ITEM-A', 50)?.unitPrice).toBe(95);
    });

    it('qty 100 → resolves to tier minQty 100 (price 90)', () => {
      expect(list.getEffectiveLine('ITEM-A', 100)?.unitPrice).toBe(90);
    });

    it('returns null for unmatched itemId', () => {
      expect(list.getEffectiveLine('ITEM-UNKNOWN', 1)).toBeNull();
    });

    it('returns null when qty is below the smallest minQty', () => {
      const highMoqList = makeList({
        lines: [{ itemId: 'ITEM-B', minQty: 5, unitPrice: 50 }],
      });
      expect(highMoqList.getEffectiveLine('ITEM-B', 3)).toBeNull();
    });
  });

  describe('isActiveOn', () => {
    it('returns false when status is INACTIVE', () => {
      const list = makeList({ status: 'INACTIVE' });
      expect(list.isActiveOn(new Date())).toBe(false);
    });

    it('returns false when date is before validFrom', () => {
      const list = makeList({ validFrom: new Date('2026-06-01') });
      expect(list.isActiveOn(new Date('2026-05-31'))).toBe(false);
    });

    it('returns false when date is after validTo', () => {
      const list = makeList({ validTo: new Date('2026-06-30') });
      expect(list.isActiveOn(new Date('2026-07-01'))).toBe(false);
    });

    it('returns true when active and within date range', () => {
      const list = makeList({
        validFrom: new Date('2026-06-01'),
        validTo: new Date('2026-06-30'),
      });
      expect(list.isActiveOn(new Date('2026-06-15'))).toBe(true);
    });
  });

  describe('Construction validations', () => {
    it('throws on duplicate (itemId, minQty) pairs', () => {
      expect(() =>
        new PurchasePriceList({
          companyId: COMPANY_ID,
          name: 'Dupe List',
          currency: 'USD',
          status: 'ACTIVE',
          isDefault: false,
          lines: [
            { itemId: 'ITEM-A', minQty: 1, unitPrice: 10 },
            { itemId: 'ITEM-A', minQty: 1, unitPrice: 9 },
          ],
          createdBy: 'u-1',
        })
      ).toThrow(/duplicate line/i);
    });

    it('throws on invalid currency length', () => {
      expect(() =>
        new PurchasePriceList({
          companyId: COMPANY_ID,
          name: 'Invalid Currency',
          currency: 'USDT',
          status: 'ACTIVE',
          isDefault: false,
          lines: [],
          createdBy: 'u-1',
        })
      ).toThrow(/currency must be exactly 3 characters/i);
    });
  });
});

describe('PurchasePriceList Use Cases', () => {
  describe('CreatePurchasePriceListUseCase', () => {
    it('creates price list and disables existing default list of the same currency if isDefault is true', async () => {
      const existingDefault = makeList({ id: 'existing-id', currency: 'USD', isDefault: true });
      const repo = makePriceListRepo({
        getDefaultForCurrency: jest.fn(async () => existingDefault) as any,
      });
      const txManager = makeTxManager();
      const uc = new CreatePurchasePriceListUseCase(repo, txManager as any);

      const result = await uc.execute({
        companyId: COMPANY_ID,
        name: 'New Default List',
        currency: 'USD',
        isDefault: true,
        createdBy: 'u-2',
        lines: [{ itemId: 'ITEM-A', unitPrice: 120 }],
      });

      expect(result.isDefault).toBe(true);
      expect(existingDefault.isDefault).toBe(false);
      expect(repo.update).toHaveBeenCalledWith(existingDefault, 'mock-txn');
      expect(repo.create).toHaveBeenCalledWith(result, 'mock-txn');
    });
  });

  describe('UpdatePurchasePriceListUseCase', () => {
    it('updates price list details and manages default currency changes', async () => {
      const list = makeList({ id: 'list-id', isDefault: false });
      const currentDefault = makeList({ id: 'default-id', isDefault: true });
      const repo = makePriceListRepo({
        getById: jest.fn(async () => list) as any,
        getDefaultForCurrency: jest.fn(async () => currentDefault) as any,
      });
      const txManager = makeTxManager();
      const uc = new UpdatePurchasePriceListUseCase(repo, txManager as any);

      const result = await uc.execute({
        companyId: COMPANY_ID,
        id: 'list-id',
        isDefault: true,
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.isDefault).toBe(true);
      expect(currentDefault.isDefault).toBe(false);
      expect(repo.update).toHaveBeenCalledWith(currentDefault, 'mock-txn');
      expect(repo.update).toHaveBeenCalledWith(result, 'mock-txn');
    });
  });

  describe('DeletePurchasePriceListUseCase', () => {
    it('deletes a price list', async () => {
      const list = makeList({ id: 'list-id' });
      const repo = makePriceListRepo({
        getById: jest.fn(async () => list) as any,
      });
      const uc = new DeletePurchasePriceListUseCase(repo);

      await uc.execute(COMPANY_ID, 'list-id');
      expect(repo.delete).toHaveBeenCalledWith(COMPANY_ID, 'list-id');
    });
  });

  describe('GetEffectivePurchasePriceUseCase', () => {
    it('resolves vendor-assigned price list price and falls back to currency default price list', async () => {
      const overrideList = makeList({
        id: 'override-id',
        isDefault: false,
        lines: [{ itemId: 'ITEM-A', minQty: 1, unitPrice: 88 }],
      });
      const defaultList = makeList({
        id: 'default-id',
        isDefault: true,
        lines: [{ itemId: 'ITEM-A', minQty: 1, unitPrice: 99 }],
      });

      const partyWithOverride = makeVendor({ defaultPriceListId: 'override-id' });
      const partyWithoutOverride = makeVendor({ defaultCurrency: 'USD' });

      const repo = makePriceListRepo({
        getById: jest.fn(async (_, id) => (id === 'override-id' ? overrideList : null)) as any,
        getDefaultForCurrency: jest.fn(async () => defaultList) as any,
      });

      const partyRepo = makePartyRepo({
        getById: jest.fn(async (_, id) => (id === 'vendor-override' ? partyWithOverride : partyWithoutOverride)) as any,
      });

      const uc = new GetEffectivePurchasePriceUseCase(repo, partyRepo);

      // Case A: Vendor has override price list assigned
      const priceA = await uc.execute({
        companyId: COMPANY_ID,
        vendorId: 'vendor-override',
        itemId: 'ITEM-A',
        qty: 1,
      });

      expect(priceA).not.toBeNull();
      expect(priceA!.unitPrice).toBe(88);
      expect(priceA!.sourcePriceListId).toBe('override-id');

      // Case B: Vendor has no price list assigned, fallback to default USD price list
      const priceB = await uc.execute({
        companyId: COMPANY_ID,
        vendorId: 'vendor-default',
        itemId: 'ITEM-A',
        qty: 1,
      });

      expect(priceB).not.toBeNull();
      expect(priceB!.unitPrice).toBe(99);
      expect(priceB!.sourcePriceListId).toBe('default-id');
    });

    it('returns null if no price list can be resolved or no line matches', async () => {
      const repo = makePriceListRepo({
        getById: jest.fn(async () => null) as any,
        getDefaultForCurrency: jest.fn(async () => null) as any,
      });
      const partyRepo = makePartyRepo({
        getById: jest.fn(async () => makeVendor()) as any,
      });

      const uc = new GetEffectivePurchasePriceUseCase(repo, partyRepo);
      const price = await uc.execute({
        companyId: COMPANY_ID,
        vendorId: 'vendor-id',
        itemId: 'ITEM-A',
        qty: 1,
      });

      expect(price).toBeNull();
    });
  });
});
