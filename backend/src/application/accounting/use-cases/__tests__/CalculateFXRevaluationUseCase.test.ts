import { CalculateFXRevaluationUseCase } from '../CalculateFXRevaluationUseCase';
import { roundMoney } from '../../../../domain/accounting/entities/VoucherLineEntity';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockInstance = {
    company: {
      findUnique: jest.fn(),
    },
    voucherLine: {
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockInstance),
  };
});

// Import the mocked PrismaClient to access the instances
import { PrismaClient } from '@prisma/client';
const mockPrisma = new (PrismaClient as any)();

describe('CalculateFXRevaluationUseCase', () => {
  let useCase: CalculateFXRevaluationUseCase;
  const companyId = 'comp-1';
  const asOfDate = new Date('2026-12-31');

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CalculateFXRevaluationUseCase();
    
    // Default mock behavior
    mockPrisma.company.findUnique.mockResolvedValue({
      id: companyId,
      baseCurrency: 'AED',
    });
  });

  it('calculates revaluation gain correctly', async () => {
    // Scenario: 
    // Account 1001 (Cash USD) has balance $1,000.
    // Historical base balance (AED) is 3,670 (Rate 3.67).
    // New rate is 4.00.
    // Target base balance = 1,000 * 4 = 4,000.
    // Delta = 4,000 - 3,670 = +330 (Gain).

    mockPrisma.voucherLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'USD',
        side: 'Debit',
        amount: 1000,
        baseAmount: 3670,
        account: {
          id: 'acc-1',
          name: 'Cash USD',
          systemCode: '1001',
        },
      },
    ]);

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { 'USD': 4.0 },
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].deltaBase).toBe(330);
    expect(result.totalGain).toBe(330);
    expect(result.totalLoss).toBe(0);
    expect(result.netDelta).toBe(330);
  });

  it('calculates revaluation loss correctly', async () => {
    // Scenario:
    // Account 2001 (AP USD) has balance -$500 (Credit).
    // Historical base balance (AED) is -1,835 (Rate 3.67).
    // New rate is 4.00.
    // Target base balance = -500 * 4 = -2,000.
    // Delta = -2,000 - (-1,835) = -165 (Loss).

    mockPrisma.voucherLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-2',
        currency: 'USD',
        side: 'Credit',
        amount: 500,
        baseAmount: 1835,
        account: {
          id: 'acc-2',
          name: 'AP USD',
          systemCode: '2001',
        },
      },
    ]);

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { 'USD': 4.0 },
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].deltaBase).toBe(-165);
    expect(result.totalGain).toBe(0);
    expect(result.totalLoss).toBe(165);
    expect(result.netDelta).toBe(-165);
  });

  it('aggregates multiple lines for the same account and currency', async () => {
    mockPrisma.voucherLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'USD',
        side: 'Debit',
        amount: 1000,
        baseAmount: 3670,
        account: { id: 'acc-1', name: 'Cash USD', systemCode: '1001' },
      },
      {
        accountId: 'acc-1',
        currency: 'USD',
        side: 'Credit',
        amount: 200,
        baseAmount: 734,
        account: { id: 'acc-1', name: 'Cash USD', systemCode: '1001' },
      },
    ]);

    // Net foreign: 1000 - 200 = 800
    // Net historical base: 3670 - 734 = 2936
    // New rate: 3.70
    // Target base: 800 * 3.7 = 2960
    // Delta: 2960 - 2936 = +24

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { 'USD': 3.7 },
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].foreignBalance).toBe(800);
    expect(result.lines[0].deltaBase).toBe(24);
  });

  it('throws error for missing exchange rate', async () => {
    mockPrisma.voucherLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'EUR',
        side: 'Debit',
        amount: 100,
        baseAmount: 400,
        account: { id: 'acc-1', name: 'Euro Account', systemCode: '1002' },
      },
    ]);

    await expect(useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { 'USD': 4.0 }, // Missing EUR
    })).rejects.toThrow('Missing or invalid exchange rate for currency: EUR');
  });

  it('skips accounts with zero net foreign balance', async () => {
    mockPrisma.voucherLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        currency: 'USD',
        side: 'Debit',
        amount: 100,
        baseAmount: 367,
        account: { id: 'acc-1', name: 'Cash USD', systemCode: '1001' },
      },
      {
        accountId: 'acc-1',
        currency: 'USD',
        side: 'Credit',
        amount: 100,
        baseAmount: 368, // Residual base balance
        account: { id: 'acc-1', name: 'Cash USD', systemCode: '1001' },
      },
    ]);

    const result = await useCase.execute({
      companyId,
      asOfDate,
      exchangeRates: { 'USD': 4.0 },
    });

    expect(result.lines).toHaveLength(0);
  });
});
