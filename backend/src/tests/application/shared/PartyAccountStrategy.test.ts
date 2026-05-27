import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  CreatePartyUseCase,
  PartyAccountAutoCreateDeps,
} from '../../../application/shared/use-cases/PartyUseCases';
import {
  renderPartyAccountCode,
  validatePartyAccountCodeFormat,
} from '../../../application/shared/services/PartyAccountCodeRenderer';

const COMPANY_ID = 'cmp-test';
const USER_ID = 'u-test';

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

describe('PartyAccountCodeRenderer', () => {
  it('renders default template {parent}-{partyCode}', () => {
    expect(renderPartyAccountCode(undefined, { parent: '1010101', partyCode: 'CUST001' })).toBe(
      '1010101-CUST001'
    );
  });

  it('renders dot separator template', () => {
    expect(
      renderPartyAccountCode('{parent}.{partyCode}', { parent: '1010101', partyCode: 'CUST001' })
    ).toBe('1010101.CUST001');
  });

  it('renders {seq3} as zero-padded sequence', () => {
    expect(
      renderPartyAccountCode('{parent}-{seq3}', { parent: '1010101', partyCode: 'CUST001', seq: 7 })
    ).toBe('1010101-007');
  });

  it('validatePartyAccountCodeFormat rejects template missing partyCode/seq3', () => {
    expect(validatePartyAccountCodeFormat('{parent}-FIXED')).toMatch(/partyCode/);
  });

  it('validatePartyAccountCodeFormat allows default', () => {
    expect(validatePartyAccountCodeFormat(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CreatePartyUseCase — accountStrategy
// ---------------------------------------------------------------------------

const makePartyRepo = () => ({
  getByCode: jest.fn(async () => null),
  create: jest.fn(async () => undefined),
  // unused
  getById: jest.fn(),
  update: jest.fn(),
  list: jest.fn(),
});

const makeCurrencyRepo = () => ({
  isEnabled: jest.fn(async () => true),
  getBaseCurrency: jest.fn(),
  list: jest.fn(),
  setEnabled: jest.fn(),
});

const makeDeps = (overrides: Partial<PartyAccountAutoCreateDeps> = {}): PartyAccountAutoCreateDeps => ({
  accountRepo: {
    getById: jest.fn(async (_c: string, id: string) => ({
      id,
      userCode: '1100',
      classification: 'ASSET',
    })) as any,
    existsByUserCode: jest.fn(async () => false) as any,
  } as any,
  createAccountUseCase: {
    execute: jest.fn(async (_c: string, data: any) => ({ id: 'new-acc-id', userCode: data.userCode })),
  } as any,
  salesSettingsRepo: {
    getSettings: jest.fn(async () => ({
      arParentAccountId: 'ar-parent',
      partyAccountCodeFormat: '{parent}-{partyCode}',
    })),
  } as any,
  purchaseSettingsRepo: {
    getSettings: jest.fn(async () => ({
      apParentAccountId: 'ap-parent',
      partyAccountCodeFormat: '{parent}-{partyCode}',
    })),
  } as any,
  ...overrides,
});

describe('CreatePartyUseCase.accountStrategy', () => {
  let partyRepo: any;
  let currencyRepo: any;

  beforeEach(() => {
    partyRepo = makePartyRepo();
    currencyRepo = makeCurrencyRepo();
  });

  const baseInput = {
    companyId: COMPANY_ID,
    code: 'CUST001',
    legalName: 'Test Customer',
    displayName: 'Test Customer',
    roles: ['CUSTOMER'] as ('CUSTOMER' | 'VENDOR')[],
    createdBy: USER_ID,
  };

  it('rejects missing accountStrategy', async () => {
    const uc = new CreatePartyUseCase(partyRepo, currencyRepo);
    await expect(uc.execute({ ...baseInput, accountStrategy: '' as any })).rejects.toThrow(
      /accountStrategy is required/
    );
  });

  it('AUTO_CREATE for CUSTOMER creates AR sub-account and sets defaultARAccountId', async () => {
    const deps = makeDeps();
    const uc = new CreatePartyUseCase(partyRepo, currencyRepo, deps);
    await uc.execute({ ...baseInput, accountStrategy: 'AUTO_CREATE' });

    expect(deps.createAccountUseCase.execute).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        userCode: '1100-CUST001',
        classification: 'ASSET',
        parentId: 'ar-parent',
        accountRole: 'POSTING',
      })
    );
    const savedParty = (partyRepo.create as jest.Mock).mock.calls[0][0] as any;
    expect(savedParty.defaultARAccountId).toBe('new-acc-id');
    expect(savedParty.defaultAPAccountId).toBeUndefined();
  });

  it('AUTO_CREATE for VENDOR creates AP sub-account under LIABILITY parent', async () => {
    const deps = makeDeps();
    (deps.accountRepo.getById as any).mockResolvedValue({
      id: 'ap-parent',
      userCode: '2100',
      classification: 'LIABILITY',
    });
    const uc = new CreatePartyUseCase(partyRepo, currencyRepo, deps);
    await uc.execute({
      ...baseInput,
      code: 'VEND001',
      roles: ['VENDOR'],
      accountStrategy: 'AUTO_CREATE',
    });

    expect(deps.createAccountUseCase.execute).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        classification: 'LIABILITY',
        parentId: 'ap-parent',
      })
    );
    const savedParty = (partyRepo.create as jest.Mock).mock.calls[0][0] as any;
    expect(savedParty.defaultAPAccountId).toBe('new-acc-id');
  });

  it('AUTO_CREATE throws if AR parent not configured', async () => {
    const deps = makeDeps({
      salesSettingsRepo: { getSettings: jest.fn(async () => ({ arParentAccountId: undefined })) } as any,
    });
    const uc = new CreatePartyUseCase(partyRepo, currencyRepo, deps);
    await expect(uc.execute({ ...baseInput, accountStrategy: 'AUTO_CREATE' })).rejects.toThrow(
      /AR Parent Account to be configured/
    );
  });

  it('AUTO_CREATE bumps {seq3} until unique', async () => {
    const deps = makeDeps({
      salesSettingsRepo: {
        getSettings: jest.fn(async () => ({
          arParentAccountId: 'ar-parent',
          partyAccountCodeFormat: '{parent}-{seq3}',
        })),
      } as any,
    });
    const existing = new Set(['1100-001', '1100-002']);
    (deps.accountRepo.existsByUserCode as any).mockImplementation(
      async (_c: string, code: string) => existing.has(code)
    );

    const uc = new CreatePartyUseCase(partyRepo, currencyRepo, deps);
    await uc.execute({ ...baseInput, accountStrategy: 'AUTO_CREATE' });

    expect(deps.createAccountUseCase.execute).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ userCode: '1100-003' })
    );
  });

  it('PICK_EXISTING validates that defaultARAccountId is ASSET-classified', async () => {
    const deps = makeDeps();
    (deps.accountRepo.getById as any).mockResolvedValue({
      id: 'acc-1',
      userCode: '5000',
      classification: 'EXPENSE',
    });

    const uc = new CreatePartyUseCase(partyRepo, currencyRepo, deps);
    await expect(
      uc.execute({
        ...baseInput,
        accountStrategy: 'PICK_EXISTING',
        defaultARAccountId: 'acc-1',
      })
    ).rejects.toThrow(/AR account must be classified as ASSET/);
  });

  it('PICK_EXISTING with valid AR account passes through defaultARAccountId', async () => {
    const deps = makeDeps();
    (deps.accountRepo.getById as any).mockResolvedValue({
      id: 'acc-1',
      userCode: '1100-EXISTING',
      classification: 'ASSET',
    });

    const uc = new CreatePartyUseCase(partyRepo, currencyRepo, deps);
    await uc.execute({
      ...baseInput,
      accountStrategy: 'PICK_EXISTING',
      defaultARAccountId: 'acc-1',
    });

    const savedParty = (partyRepo.create as jest.Mock).mock.calls[0][0] as any;
    expect(savedParty.defaultARAccountId).toBe('acc-1');
    expect(deps.createAccountUseCase.execute).not.toHaveBeenCalled();
  });
});
