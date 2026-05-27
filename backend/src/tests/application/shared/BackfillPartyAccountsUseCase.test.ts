import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BackfillPartyAccountsUseCase } from '../../../application/shared/use-cases/BackfillPartyAccountsUseCase';
import { Party } from '../../../domain/shared/entities/Party';

const COMPANY_ID = 'cmp-1';

const makeParty = (overrides: Partial<ReturnType<Party['toJSON']>> = {}) =>
  Party.fromJSON({
    id: overrides.id || `p-${Math.random().toString(36).slice(2, 8)}`,
    companyId: COMPANY_ID,
    code: overrides.code || 'CUST001',
    legalName: overrides.legalName || 'Customer One',
    displayName: overrides.displayName || 'Customer One',
    roles: overrides.roles || ['CUSTOMER'],
    defaultARAccountId: overrides.defaultARAccountId,
    defaultAPAccountId: overrides.defaultAPAccountId,
    active: true,
    createdBy: 'seed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

describe('BackfillPartyAccountsUseCase', () => {
  let partyRepo: any;
  let accountRepo: any;
  let salesSettingsRepo: any;
  let purchaseSettingsRepo: any;
  let companyRepo: any;
  let companyCurrencyRepo: any;

  beforeEach(() => {
    partyRepo = {
      list: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(async () => undefined),
      create: jest.fn(),
      getByCode: jest.fn(),
      delete: jest.fn(),
    };

    accountRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => ({
        id,
        userCode: id === 'ar-parent' ? '1100' : '2100',
        classification: id === 'ap-parent' ? 'LIABILITY' : 'ASSET',
        accountRole: 'HEADER',
        parentId: null,
        currencyPolicy: 'INHERIT',
        fixedCurrencyCode: null,
      })),
      existsByUserCode: jest.fn(async () => false),
      isUsed: jest.fn(async () => false),
      create: jest.fn(async (_companyId: string, payload: any) => ({
        id: `acc-${payload.userCode}`,
        userCode: payload.userCode,
      })),
      update: jest.fn(async () => ({})),
    };

    salesSettingsRepo = {
      getSettings: jest.fn(async () => ({
        arParentAccountId: 'ar-parent',
        partyAccountCodeFormat: '{parent}-{partyCode}',
      })),
    };

    purchaseSettingsRepo = {
      getSettings: jest.fn(async () => ({
        apParentAccountId: 'ap-parent',
        partyAccountCodeFormat: '{parent}-{partyCode}',
      })),
    };

    companyRepo = {
      findById: jest.fn(async () => ({ id: COMPANY_ID, baseCurrency: 'USD' })),
    };

    companyCurrencyRepo = {
      getBaseCurrency: jest.fn(async () => 'USD'),
      isEnabled: jest.fn(async () => true),
    };
  });

  it('creates AR sub-account for customer without dedicated account', async () => {
    const party = makeParty({ id: 'p1', code: 'CUST001', roles: ['CUSTOMER'] });
    partyRepo.list.mockResolvedValue([party]);
    partyRepo.getById.mockResolvedValue(party);

    const useCase = new BackfillPartyAccountsUseCase(
      partyRepo,
      accountRepo,
      salesSettingsRepo,
      purchaseSettingsRepo,
      companyRepo,
      companyCurrencyRepo
    );

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      actorId: 'u1',
      scope: 'AR',
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(partyRepo.update).toHaveBeenCalled();
  });

  it('skips when default AR already points to child under AR parent', async () => {
    const party = makeParty({
      id: 'p2',
      code: 'CUST002',
      roles: ['CUSTOMER'],
      defaultARAccountId: 'ar-child',
    });
    partyRepo.list.mockResolvedValue([party]);
    accountRepo.getById.mockImplementation(async (_companyId: string, id: string) => {
      if (id === 'ar-child') {
        return {
          id: 'ar-child',
          userCode: '1100-CUST002',
          classification: 'ASSET',
          parentId: 'ar-parent',
        };
      }
      return {
        id: 'ar-parent',
        userCode: '1100',
        classification: 'ASSET',
        accountRole: 'HEADER',
        parentId: null,
        currencyPolicy: 'INHERIT',
        fixedCurrencyCode: null,
      };
    });

    const useCase = new BackfillPartyAccountsUseCase(
      partyRepo,
      accountRepo,
      salesSettingsRepo,
      purchaseSettingsRepo,
      companyRepo,
      companyCurrencyRepo
    );

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      actorId: 'u1',
      scope: 'AR',
    });

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(partyRepo.update).not.toHaveBeenCalled();
  });

  it('collects party errors and continues processing', async () => {
    const p1 = makeParty({ id: 'p3', code: 'CUST003', roles: ['CUSTOMER'] });
    const p2 = makeParty({ id: 'p4', code: 'CUST004', roles: ['CUSTOMER'] });
    partyRepo.list.mockResolvedValue([p1, p2]);
    partyRepo.getById.mockImplementation(async (_companyId: string, id: string) => (id === p1.id ? p1 : p2));

    let createCalls = 0;
    accountRepo.create.mockImplementation(async (_companyId: string, payload: any) => {
      createCalls += 1;
      if (createCalls === 1) {
        throw new Error(`Account with user code ${payload.userCode} already exists`);
      }
      return {
        id: `acc-${payload.userCode}`,
        userCode: payload.userCode,
      };
    });

    const useCase = new BackfillPartyAccountsUseCase(
      partyRepo,
      accountRepo,
      salesSettingsRepo,
      purchaseSettingsRepo,
      companyRepo,
      companyCurrencyRepo
    );

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      actorId: 'u1',
      scope: 'AR',
    });

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].partyId).toBe('p3');
  });
});

