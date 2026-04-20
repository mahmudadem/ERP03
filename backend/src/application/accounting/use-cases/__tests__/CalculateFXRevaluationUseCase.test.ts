import { CalculateFXRevaluationUseCase } from '../CalculateFXRevaluationUseCase';

describe('CalculateFXRevaluationUseCase', () => {
  let useCase: CalculateFXRevaluationUseCase;
  const companyId = 'comp-1';
  const asOfDate = new Date('2026-12-31');

  const ledgerRepo = {
    getForeignBalances: jest.fn(),
  } as any;

  const accountRepo = {
    getById: jest.fn(),
  } as any;

  const companyRepo = {
    findById: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CalculateFXRevaluationUseCase(ledgerRepo, accountRepo, companyRepo);

    companyRepo.findById.mockResolvedValue({
      id: companyId,
      baseCurrency: 'AED',
    });
  });

  it('calculates revaluation gain correctly', async () => {
    ledgerRepo.getForeignBalances.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'USD',
        foreignBalance: 1000,
        baseBalance: 3670,
      },
    ]);
    accountRepo.getById.mockResolvedValue({
      id: 'acc-1',
      name: 'Cash USD',
      systemCode: '1001',
    });

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { USD: 4.0 },
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].deltaBase).toBe(330);
    expect(result.totalGain).toBe(330);
    expect(result.totalLoss).toBe(0);
    expect(result.netDelta).toBe(330);
  });

  it('calculates revaluation loss correctly', async () => {
    ledgerRepo.getForeignBalances.mockResolvedValue([
      {
        accountId: 'acc-2',
        currency: 'USD',
        foreignBalance: -500,
        baseBalance: -1835,
      },
    ]);
    accountRepo.getById.mockResolvedValue({
      id: 'acc-2',
      name: 'AP USD',
      systemCode: '2001',
    });

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { USD: 4.0 },
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].deltaBase).toBe(-165);
    expect(result.totalGain).toBe(0);
    expect(result.totalLoss).toBe(165);
    expect(result.netDelta).toBe(-165);
  });

  it('aggregates multiple lines for the same account and currency via ledger input', async () => {
    ledgerRepo.getForeignBalances.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'USD',
        foreignBalance: 800,
        baseBalance: 2936,
      },
    ]);
    accountRepo.getById.mockResolvedValue({
      id: 'acc-1',
      name: 'Cash USD',
      systemCode: '1001',
    });

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { USD: 3.7 },
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].foreignBalance).toBe(800);
    expect(result.lines[0].deltaBase).toBe(24);
  });

  it('throws error for missing exchange rate', async () => {
    ledgerRepo.getForeignBalances.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'EUR',
        foreignBalance: 100,
        baseBalance: 400,
      },
    ]);
    accountRepo.getById.mockResolvedValue({
      id: 'acc-1',
      name: 'Euro Account',
      systemCode: '1002',
    });

    await expect(
      useCase.execute({
        companyId,
        asOfDate,
        exchangeRates: { USD: 4.0 },
      })
    ).rejects.toThrow('Missing or invalid exchange rate for currency: EUR');
  });

  it('skips accounts with zero net foreign balance', async () => {
    ledgerRepo.getForeignBalances.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'USD',
        foreignBalance: 0,
        baseBalance: -1,
      },
    ]);

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { USD: 4.0 },
    });

    expect(result.lines).toHaveLength(0);
  });
});
