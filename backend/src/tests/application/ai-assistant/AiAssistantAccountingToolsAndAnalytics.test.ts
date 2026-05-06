import { ApiError } from '../../../api/errors/ApiError';
import { GetProfitAndLossTool } from '../../../application/ai-assistant/tools/GetProfitAndLossTool';
import { GetBalanceSheetTool } from '../../../application/ai-assistant/tools/GetBalanceSheetTool';
import { GetUsageAnalyticsUseCase } from '../../../application/ai-assistant/use-cases/GetUsageAnalyticsUseCase';
import { AiUsageLog } from '../../../domain/ai-assistant/entities/AiUsageLog';

describe('AI Assistant Accounting Tools', () => {
  const baseContext = {
    companyId: 'cmp-1',
    userId: 'user-1',
    permissions: ['*'],
  };

  it('GetProfitAndLossTool should return sanitized summary data', async () => {
    const ledgerRepo = {
      getTrialBalance: jest
        .fn()
        .mockResolvedValueOnce([
          { accountId: 'rev-1', debit: 0, credit: 0 },
          { accountId: 'exp-1', debit: 0, credit: 0 },
        ])
        .mockResolvedValueOnce([
          { accountId: 'rev-1', debit: 0, credit: 1000 },
          { accountId: 'exp-1', debit: 300, credit: 0 },
        ]),
    } as any;

    const accountRepo = {
      list: jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          classification: 'REVENUE',
          userCode: '4000',
          name: 'Sales Revenue',
          plSubgroup: 'SALES',
        },
        {
          id: 'exp-1',
          classification: 'EXPENSE',
          userCode: '5000',
          name: 'Operating Expenses',
          plSubgroup: 'OPERATING_EXPENSES',
        },
      ]),
    } as any;

    const permissionChecker = {
      assertOrThrow: jest.fn().mockResolvedValue(undefined),
    } as any;

    const tool = new GetProfitAndLossTool(ledgerRepo, accountRepo, permissionChecker);

    const result = await tool.execute(baseContext as any, {
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      revenue: 1000,
      expenses: 300,
      netProfit: 700,
      period: { from: '2026-05-01', to: '2026-05-31' },
    });
    expect((result.data as any).revenueBreakdown.length).toBeGreaterThan(0);
    expect((result.data as any).expensesBreakdown.length).toBeGreaterThan(0);
  });

  it('GetProfitAndLossTool should return failure when permission denied', async () => {
    const ledgerRepo = { getTrialBalance: jest.fn() } as any;
    const accountRepo = { list: jest.fn() } as any;
    const permissionChecker = {
      assertOrThrow: jest
        .fn()
        .mockRejectedValue(ApiError.forbidden("Missing permission 'accounting.reports.profitAndLoss.view'")),
    } as any;

    const tool = new GetProfitAndLossTool(ledgerRepo, accountRepo, permissionChecker);
    const result = await tool.execute(baseContext as any, {
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TOOL_EXECUTION_ERROR');
    expect(result.error).toContain('Missing permission');
  });

  it('GetBalanceSheetTool should return summary totals and balance status', async () => {
    const ledgerRepo = {
      getTrialBalance: jest.fn().mockResolvedValue([
        { accountId: 'asset-1', debit: 1500, credit: 0 },
        { accountId: 'liab-1', debit: 0, credit: 600 },
        { accountId: 'eq-1', debit: 0, credit: 900 },
      ]),
    } as any;

    const accountRepo = {
      list: jest.fn().mockResolvedValue([
        {
          id: 'asset-1',
          classification: 'ASSET',
          userCode: '1000',
          name: 'Cash',
          balanceNature: 'DEBIT',
          parentId: null,
        },
        {
          id: 'liab-1',
          classification: 'LIABILITY',
          userCode: '2000',
          name: 'Accounts Payable',
          balanceNature: 'CREDIT',
          parentId: null,
        },
        {
          id: 'eq-1',
          classification: 'EQUITY',
          userCode: '3000',
          name: 'Owner Equity',
          balanceNature: 'CREDIT',
          parentId: null,
        },
      ]),
    } as any;

    const permissionChecker = {
      assertOrThrow: jest.fn().mockResolvedValue(undefined),
    } as any;

    const companyRepo = {
      findById: jest.fn().mockResolvedValue({ baseCurrency: 'USD' }),
    } as any;

    const tool = new GetBalanceSheetTool(
      ledgerRepo,
      accountRepo,
      permissionChecker,
      companyRepo,
    );

    const result = await tool.execute(baseContext as any, {
      asOfDate: '2026-05-31',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      asOfDate: '2026-05-31',
      totalAssets: 1500,
      totalLiabilities: 600,
      totalEquity: 900,
      totalLiabilitiesAndEquity: 1500,
      isBalanced: true,
      difference: 0,
    });
    expect((result.data as any).topAssets.length).toBeGreaterThan(0);
  });
});

describe('GetUsageAnalyticsUseCase', () => {
  it('should aggregate summary and map recent logs', async () => {
    const repo = {
      countTodayByCompany: jest.fn().mockResolvedValue(12),
      getByCompany: jest.fn().mockResolvedValue([
        new AiUsageLog(
          'log-1',
          'cmp-1',
          'user-1',
          'mock',
          'mock-assistant',
          3,
          10,
          20,
          30,
          'success',
          undefined,
          120,
          new Date('2026-05-06T10:00:00.000Z'),
        ),
        new AiUsageLog(
          'log-2',
          'cmp-1',
          'user-2',
          'openai_compatible',
          'gpt-4o',
          4,
          20,
          10,
          30,
          'failure',
          'AI_PROVIDER_AUTH_ERROR',
          300,
          new Date('2026-05-06T11:00:00.000Z'),
        ),
      ]),
    } as any;

    const useCase = new GetUsageAnalyticsUseCase(repo);
    const result = await useCase.execute({ companyId: 'cmp-1', limit: 50 });

    expect(result.summary.todayRequests).toBe(12);
    expect(result.summary.successCount).toBe(1);
    expect(result.summary.failureCount).toBe(1);
    expect(result.summary.totalTokens).toBe(60);
    expect(result.summary.avgLatencyMs).toBe(210);
    expect(result.summary.providerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ providerType: 'mock', count: 1 }),
        expect.objectContaining({ providerType: 'openai_compatible', count: 1 }),
      ]),
    );
    expect(result.recentLogs).toHaveLength(2);
    expect(result.recentLogs[1].errorCode).toBe('AI_PROVIDER_AUTH_ERROR');
  });

  it('should clamp limit between 1 and 200', async () => {
    const repo = {
      countTodayByCompany: jest.fn().mockResolvedValue(0),
      getByCompany: jest.fn().mockResolvedValue([]),
    } as any;

    const useCase = new GetUsageAnalyticsUseCase(repo);
    await useCase.execute({ companyId: 'cmp-1', limit: 9999 });

    expect(repo.getByCompany).toHaveBeenCalledWith('cmp-1', 200, 0);
  });
});
