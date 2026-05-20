import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { CustomerGroup } from '../../../domain/sales/entities/CustomerGroup';
import { Party } from '../../../domain/shared/entities/Party';
import {
  CreateCustomerGroupUseCase,
  UpdateCustomerGroupUseCase,
  DeleteCustomerGroupUseCase,
  AssignCustomerToGroupUseCase,
} from '../../../application/sales/use-cases/CustomerGroupUseCases';
import { ICustomerGroupRepository } from '../../../repository/interfaces/sales/ICustomerGroupRepository';
import { IPriceListRepository } from '../../../repository/interfaces/sales/IPriceListRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-cg-test';

const makeGroup = (overrides: Partial<ConstructorParameters<typeof CustomerGroup>[0]> = {}) =>
  new CustomerGroup({
    companyId: COMPANY_ID,
    name: 'Retail',
    taxExempt: false,
    status: 'ACTIVE',
    createdBy: 'u-test',
    ...overrides,
  });

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

/** Build a minimal mock CustomerGroup repository */
const makeGroupRepo = (
  overrides: Partial<ICustomerGroupRepository> = {}
): jest.Mocked<ICustomerGroupRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByName: jest.fn(async () => null),
    list: jest.fn(async () => []),
    delete: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<ICustomerGroupRepository>);

/** Build a minimal mock PriceList repository */
const makePriceListRepo = (
  overrides: Partial<IPriceListRepository> = {}
): jest.Mocked<IPriceListRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByName: jest.fn(async () => null),
    list: jest.fn(async () => []),
    getDefaultForCurrency: jest.fn(async () => null),
    delete: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<IPriceListRepository>);

/** Build a minimal mock Party repository */
const makePartyRepo = (
  overrides: Partial<IPartyRepository> = {}
): jest.Mocked<IPartyRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByCode: jest.fn(async () => null),
    list: jest.fn(async () => []),
    delete: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<IPartyRepository>);

// ---------------------------------------------------------------------------
// 1. CustomerGroup constructor — negative defaultPaymentTermsDays
// ---------------------------------------------------------------------------

describe('CustomerGroup constructor validation', () => {
  it('rejects negative defaultPaymentTermsDays', () => {
    expect(() =>
      new CustomerGroup({
        companyId: COMPANY_ID,
        name: 'Bad Group',
        defaultPaymentTermsDays: -1,
        taxExempt: false,
        status: 'ACTIVE',
        createdBy: 'u-test',
      })
    ).toThrow(/defaultPaymentTermsDays must be >= 0/i);
  });

  // 2. CustomerGroup constructor — negative defaultCreditLimit
  it('rejects negative defaultCreditLimit', () => {
    expect(() =>
      new CustomerGroup({
        companyId: COMPANY_ID,
        name: 'Bad Group',
        defaultCreditLimit: -100,
        taxExempt: false,
        status: 'ACTIVE',
        createdBy: 'u-test',
      })
    ).toThrow(/defaultCreditLimit must be >= 0/i);
  });
});

// ---------------------------------------------------------------------------
// 3. CreateCustomerGroupUseCase
// ---------------------------------------------------------------------------

describe('CreateCustomerGroupUseCase', () => {
  it('throws when name already exists in company', async () => {
    const existingGroup = makeGroup();
    const groupRepo = makeGroupRepo({
      getByName: jest.fn(async () => existingGroup),
    });
    const priceListRepo = makePriceListRepo();
    const uc = new CreateCustomerGroupUseCase(groupRepo, priceListRepo);

    await expect(
      uc.execute({
        companyId: COMPANY_ID,
        name: 'Retail',
        createdBy: 'u-test',
      })
    ).rejects.toThrow(/already exists/i);
  });

  // 4. throws when defaultPriceListId references non-existent PriceList
  it('throws when defaultPriceListId references non-existent PriceList', async () => {
    const groupRepo = makeGroupRepo();
    const priceListRepo = makePriceListRepo({
      getById: jest.fn(async () => null),
    });
    const uc = new CreateCustomerGroupUseCase(groupRepo, priceListRepo);

    await expect(
      uc.execute({
        companyId: COMPANY_ID,
        name: 'VIP',
        defaultPriceListId: 'pl-nonexistent',
        createdBy: 'u-test',
      })
    ).rejects.toThrow(/PriceList not found/i);
  });

  // 5a. creates successfully when name is unique and no priceListId
  it('creates successfully when name is unique and no priceListId', async () => {
    const groupRepo = makeGroupRepo();
    const priceListRepo = makePriceListRepo();
    const uc = new CreateCustomerGroupUseCase(groupRepo, priceListRepo);

    const result = await uc.execute({
      companyId: COMPANY_ID,
      name: 'Wholesale',
      createdBy: 'u-test',
    });

    expect(result).toBeInstanceOf(CustomerGroup);
    expect(result.name).toBe('Wholesale');
    expect(groupRepo.create).toHaveBeenCalledTimes(1);
  });

  // 5b. creates successfully when name is unique and valid priceListId
  it('creates successfully when name is unique and valid priceListId provided', async () => {
    const fakeList = { id: 'pl-1' } as any;
    const groupRepo = makeGroupRepo();
    const priceListRepo = makePriceListRepo({
      getById: jest.fn(async () => fakeList),
    });
    const uc = new CreateCustomerGroupUseCase(groupRepo, priceListRepo);

    const result = await uc.execute({
      companyId: COMPANY_ID,
      name: 'VIP',
      defaultPriceListId: 'pl-1',
      createdBy: 'u-test',
    });

    expect(result.defaultPriceListId).toBe('pl-1');
    expect(groupRepo.create).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 6. UpdateCustomerGroupUseCase
// ---------------------------------------------------------------------------

describe('UpdateCustomerGroupUseCase', () => {
  it('throws on name conflict with a different group', async () => {
    const self = makeGroup({ id: 'cg-1', name: 'Retail' });
    const conflictGroup = makeGroup({ id: 'cg-2', name: 'Wholesale' });

    const groupRepo = makeGroupRepo({
      getById: jest.fn(async () => self),
      getByName: jest.fn(async () => conflictGroup), // different group has this name
    });
    const priceListRepo = makePriceListRepo();
    const uc = new UpdateCustomerGroupUseCase(groupRepo, priceListRepo);

    await expect(
      uc.execute({
        companyId: COMPANY_ID,
        id: 'cg-1',
        name: 'Wholesale',
      })
    ).rejects.toThrow(/already exists/i);
  });

  // 7. allows renaming if no conflict
  it('allows renaming if no conflict', async () => {
    const self = makeGroup({ id: 'cg-1', name: 'Retail' });

    const groupRepo = makeGroupRepo({
      getById: jest.fn(async () => self),
      getByName: jest.fn(async () => null), // no conflict
    });
    const priceListRepo = makePriceListRepo();
    const uc = new UpdateCustomerGroupUseCase(groupRepo, priceListRepo);

    const result = await uc.execute({
      companyId: COMPANY_ID,
      id: 'cg-1',
      name: 'Renamed Group',
    });

    expect(result.name).toBe('Renamed Group');
    expect(groupRepo.update).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 8. DeleteCustomerGroupUseCase
// ---------------------------------------------------------------------------

describe('DeleteCustomerGroupUseCase', () => {
  it('throws when at least one Party references the group', async () => {
    const group = makeGroup({ id: 'cg-1' });
    const referencingParty = makeParty();
    (referencingParty as any).customerGroupId = 'cg-1';

    const groupRepo = makeGroupRepo({
      getById: jest.fn(async () => group),
    });
    const partyRepo = makePartyRepo({
      list: jest.fn(async () => [referencingParty]),
    });
    const uc = new DeleteCustomerGroupUseCase(groupRepo, partyRepo);

    await expect(uc.execute(COMPANY_ID, 'cg-1')).rejects.toThrow(
      /cannot delete/i
    );
  });

  // 9. succeeds when no Party references it
  it('succeeds when no Party references the group', async () => {
    const group = makeGroup({ id: 'cg-1' });
    const unrelatedParty = makeParty(); // no customerGroupId

    const groupRepo = makeGroupRepo({
      getById: jest.fn(async () => group),
    });
    const partyRepo = makePartyRepo({
      list: jest.fn(async () => [unrelatedParty]),
    });
    const uc = new DeleteCustomerGroupUseCase(groupRepo, partyRepo);

    await uc.execute(COMPANY_ID, 'cg-1');
    expect(groupRepo.delete).toHaveBeenCalledWith(COMPANY_ID, 'cg-1');
  });
});

// ---------------------------------------------------------------------------
// 10–12. AssignCustomerToGroupUseCase
// ---------------------------------------------------------------------------

describe('AssignCustomerToGroupUseCase', () => {
  it('updates party customerGroupId when assigned a valid active group', async () => {
    const group = makeGroup({ id: 'cg-1', status: 'ACTIVE' });
    const party = makeParty();

    const groupRepo = makeGroupRepo({
      getById: jest.fn(async () => group),
    });
    const partyRepo = makePartyRepo({
      getById: jest.fn(async () => party),
      update: jest.fn(async () => {}),
    });
    const uc = new AssignCustomerToGroupUseCase(groupRepo, partyRepo);

    await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'party-1',
      customerGroupId: 'cg-1',
    });

    expect((party as any).customerGroupId).toBe('cg-1');
    expect(partyRepo.update).toHaveBeenCalledWith(party);
  });

  // 11. clears the assignment when given null
  it('clears customerGroupId when given null', async () => {
    const party = makeParty();
    (party as any).customerGroupId = 'cg-1';

    const groupRepo = makeGroupRepo();
    const partyRepo = makePartyRepo({
      getById: jest.fn(async () => party),
      update: jest.fn(async () => {}),
    });
    const uc = new AssignCustomerToGroupUseCase(groupRepo, partyRepo);

    await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'party-1',
      customerGroupId: null,
    });

    expect((party as any).customerGroupId).toBeUndefined();
    expect(partyRepo.update).toHaveBeenCalledWith(party);
  });

  // 12. throws when target group is INACTIVE
  it('throws when target group is INACTIVE', async () => {
    const inactiveGroup = makeGroup({ id: 'cg-2', status: 'INACTIVE' });

    const groupRepo = makeGroupRepo({
      getById: jest.fn(async () => inactiveGroup),
    });
    const partyRepo = makePartyRepo();
    const uc = new AssignCustomerToGroupUseCase(groupRepo, partyRepo);

    await expect(
      uc.execute({
        companyId: COMPANY_ID,
        customerId: 'party-1',
        customerGroupId: 'cg-2',
      })
    ).rejects.toThrow(/inactive/i);
  });
});

// ---------------------------------------------------------------------------
// 13. Party — customerGroupId round-trip
// ---------------------------------------------------------------------------

describe('Party customerGroupId', () => {
  it('accepts customerGroupId in constructor and serializes through toJSON/fromJSON', () => {
    const party = makeParty({ customerGroupId: 'cg-99' });

    expect(party.customerGroupId).toBe('cg-99');

    const json = party.toJSON();
    expect(json.customerGroupId).toBe('cg-99');

    const restored = Party.fromJSON(json);
    expect(restored.customerGroupId).toBe('cg-99');
  });
});
