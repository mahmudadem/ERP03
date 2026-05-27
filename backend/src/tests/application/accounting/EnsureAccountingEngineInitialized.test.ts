import { describe, expect, it, jest } from '@jest/globals';
import { EnsureAccountingEngineInitialized } from '../../../application/accounting/use-cases/EnsureAccountingEngineInitialized';
import { AccountingEngineUnavailableError } from '../../../domain/accounting/errors/AccountingEngineUnavailableError';

const COMPANY_ID = 'cmp-acct-engine';

describe('EnsureAccountingEngineInitialized', () => {
  it('is a no-op when accounting module is already initialized', async () => {
    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: true })),
    } as any;
    const companyRepo = {
      findById: jest.fn(),
    } as any;
    const initializeAccountingUseCase = {
      execute: jest.fn(),
    } as any;

    const useCase = new EnsureAccountingEngineInitialized(
      companyModuleRepo,
      companyRepo,
      initializeAccountingUseCase
    );

    await useCase.execute(COMPANY_ID);

    expect(companyModuleRepo.get).toHaveBeenCalledWith(COMPANY_ID, 'accounting');
    expect(initializeAccountingUseCase.execute).not.toHaveBeenCalled();
  });

  it('calls InitializeAccountingUseCase with safe defaults when engine is not initialized and company has baseCurrency', async () => {
    const baseCurrency = 'USD';
    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: false })),
    } as any;
    const companyRepo = {
      findById: jest.fn(async () => ({ id: COMPANY_ID, baseCurrency })),
    } as any;
    const initializeAccountingUseCase = {
      execute: jest.fn(async () => undefined),
    } as any;

    const useCase = new EnsureAccountingEngineInitialized(
      companyModuleRepo,
      companyRepo,
      initializeAccountingUseCase
    );

    await useCase.execute(COMPANY_ID);

    expect(initializeAccountingUseCase.execute).toHaveBeenCalledTimes(1);
    expect(initializeAccountingUseCase.execute).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      config: {
        baseCurrency,
        coaTemplate: 'standard',
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        periodScheme: 'MONTHLY',
        selectedVoucherTypes: [],
      },
    });
  });

  it('throws AccountingEngineUnavailableError with reason MISSING_BASE_CURRENCY when company baseCurrency is absent', async () => {
    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: false })),
    } as any;
    const companyRepo = {
      findById: jest.fn(async () => ({ id: COMPANY_ID, baseCurrency: '' })),
    } as any;
    const initializeAccountingUseCase = {
      execute: jest.fn(),
    } as any;

    const useCase = new EnsureAccountingEngineInitialized(
      companyModuleRepo,
      companyRepo,
      initializeAccountingUseCase
    );

    await expect(useCase.execute(COMPANY_ID)).rejects.toThrow(AccountingEngineUnavailableError);

    let thrown: AccountingEngineUnavailableError | null = null;
    try {
      await useCase.execute(COMPANY_ID);
    } catch (err: any) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AccountingEngineUnavailableError);
    expect(thrown!.message).toContain('base currency is not set');
    expect(thrown!.name).toBe('AccountingEngineUnavailableError');
    expect(initializeAccountingUseCase.execute).not.toHaveBeenCalled();
  });

  it('wraps InitializeAccountingUseCase errors in AccountingEngineUnavailableError with reason MISSING_COA_TEMPLATE when message contains "COA Template"', async () => {
    const baseCurrency = 'EUR';
    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: false })),
    } as any;
    const companyRepo = {
      findById: jest.fn(async () => ({ id: COMPANY_ID, baseCurrency })),
    } as any;
    const initializeAccountingUseCase = {
      execute: jest.fn(async () => {
        throw new Error('COA Template not found for the given configuration');
      }),
    } as any;

    const useCase = new EnsureAccountingEngineInitialized(
      companyModuleRepo,
      companyRepo,
      initializeAccountingUseCase
    );

    let thrown: AccountingEngineUnavailableError | null = null;
    try {
      await useCase.execute(COMPANY_ID);
    } catch (err: any) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AccountingEngineUnavailableError);
    expect(thrown!.name).toBe('AccountingEngineUnavailableError');
    expect(thrown!.message).toContain('no default chart-of-accounts template found');
  });
});
