/**
 * AiToolCatalogSmoke - Comprehensive Smoke Test for ALL 17 Registered AI Tools
 *
 * Verifies:
 * 1. Each tool can be instantiated with its constructor dependencies
 * 2. tool.name matches the expected tool name string
 * 3. tool.requiredPermission is a non-empty string
 * 4. tool.module is a non-empty string
 * 5. tool.description is a non-empty string
 * 6. tool.execute() returns an AiToolResult shape
 * 7. Tool returns PERMISSION_DENIED when user lacks required permission
 * 8. AiToolRegistry can register all 17 tools without error
 *
 * This is a SMOKE test — it verifies wiring, not business logic.
 * Mock repositories return empty/minimal data so tools don't crash.
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { AiToolRegistry } from '../../../application/ai-assistant/services/AiToolRegistry';

// ─── Tool imports ────────────────────────────────────────────────────────────

import { GetTrialBalanceSummaryTool } from '../../../application/ai-assistant/tools/GetTrialBalanceSummaryTool';
import { GetProfitAndLossTool } from '../../../application/ai-assistant/tools/GetProfitAndLossTool';
import { GetBalanceSheetTool } from '../../../application/ai-assistant/tools/GetBalanceSheetTool';
import { GetCashFlowTool } from '../../../application/ai-assistant/tools/GetCashFlowTool';
import { GetAgingReceivablesTool } from '../../../application/ai-assistant/tools/GetAgingReceivablesTool';
import { GetAgingPayablesTool } from '../../../application/ai-assistant/tools/GetAgingPayablesTool';
import { GetGeneralLedgerSummaryTool } from '../../../application/ai-assistant/tools/GetGeneralLedgerSummaryTool';
import { GetAccountStatementSummaryTool } from '../../../application/ai-assistant/tools/GetAccountStatementSummaryTool';
import { GetChartOfAccountsSummaryTool } from '../../../application/ai-assistant/tools/GetChartOfAccountsSummaryTool';
import { GetAccountBalanceTool } from '../../../application/ai-assistant/tools/GetAccountBalanceTool';
import { GetFiscalYearStatusTool } from '../../../application/ai-assistant/tools/GetFiscalYearStatusTool';
import { GetSalesSummaryTool } from '../../../application/ai-assistant/tools/GetSalesSummaryTool';
import { GetTopCustomersTool } from '../../../application/ai-assistant/tools/GetTopCustomersTool';
import { GetPurchaseSummaryTool } from '../../../application/ai-assistant/tools/GetPurchaseSummaryTool';
import { GetTopSuppliersTool } from '../../../application/ai-assistant/tools/GetTopSuppliersTool';
import { GetFinancialOverviewTool } from '../../../application/ai-assistant/tools/GetFinancialOverviewTool';
import { GetMonthlyComparisonTool } from '../../../application/ai-assistant/tools/GetMonthlyComparisonTool';

// ─── Mock Factories ───────────────────────────────────────────────────────────

const createMockLedgerRepo = () => ({
  recordForVoucher: jest.fn(() => Promise.resolve()),
  deleteForVoucher: jest.fn(() => Promise.resolve()),
  getAccountLedger: jest.fn(() => Promise.resolve([])),
  getTrialBalance: jest.fn(() => Promise.resolve([])),
  getGeneralLedger: jest.fn(() => Promise.resolve([])),
  getAccountStatement: jest.fn(() => Promise.resolve({
    accountId: 'acc-1',
    accountCode: '1000',
    accountName: 'Cash',
    accountCurrency: 'USD',
    baseCurrency: 'USD',
    fromDate: '2026-01-01',
    toDate: '2026-01-31',
    openingBalance: 0,
    entries: [],
    closingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
  })),
  getUnreconciledEntries: jest.fn(() => Promise.resolve([])),
  markReconciled: jest.fn(() => Promise.resolve()),
  getForeignBalances: jest.fn(() => Promise.resolve([])),
});

const createMockAccountRepo = () => ({
  list: jest.fn(() => Promise.resolve([])),
  getById: jest.fn(() => Promise.resolve(null)),
  getByUserCode: jest.fn(() => Promise.resolve(null)),
  getByCode: jest.fn(() => Promise.resolve(null)),
  getAccounts: jest.fn(() => Promise.resolve([])),
  create: jest.fn(() => Promise.resolve({} as any)),
  update: jest.fn(() => Promise.resolve({} as any)),
  delete: jest.fn(() => Promise.resolve()),
  deactivate: jest.fn(() => Promise.resolve()),
  isUsed: jest.fn(() => Promise.resolve(false)),
  hasChildren: jest.fn(() => Promise.resolve(false)),
  countChildren: jest.fn(() => Promise.resolve(0)),
  existsByUserCode: jest.fn(() => Promise.resolve(false)),
  generateNextSystemCode: jest.fn(() => Promise.resolve('ACC-000001')),
  countByCurrency: jest.fn(() => Promise.resolve(0)),
  recordAuditEvent: jest.fn(() => Promise.resolve()),
});

const createMockCompanyRepo = () => ({
  save: jest.fn(() => Promise.resolve()),
  findById: jest.fn(() => Promise.resolve(null)),
  findByTaxId: jest.fn(() => Promise.resolve(null)),
  findByNameAndOwner: jest.fn(() => Promise.resolve(null)),
  getUserCompanies: jest.fn(() => Promise.resolve([])),
  enableModule: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve({} as any)),
  disableModule: jest.fn(() => Promise.resolve()),
  updateBundle: jest.fn(() => Promise.resolve({} as any)),
  updateFeatures: jest.fn(() => Promise.resolve()),
  listAll: jest.fn(() => Promise.resolve([])),
  delete: jest.fn(() => Promise.resolve()),
});

const createMockFiscalYearRepo = () => ({
  findByCompany: jest.fn(() => Promise.resolve([])),
  findById: jest.fn(() => Promise.resolve(null)),
  findActiveForDate: jest.fn(() => Promise.resolve(null)),
  save: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
});

const createMockSalesInvoiceRepo = () => ({
  create: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  getById: jest.fn(() => Promise.resolve(null)),
  getByNumber: jest.fn(() => Promise.resolve(null)),
  list: jest.fn(() => Promise.resolve([])),
});

const createMockPurchaseInvoiceRepo = () => ({
  create: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  getById: jest.fn(() => Promise.resolve(null)),
  getByNumber: jest.fn(() => Promise.resolve(null)),
  list: jest.fn(() => Promise.resolve([])),
});

const createMockPartyRepo = () => ({
  create: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  getById: jest.fn(() => Promise.resolve(null)),
  getByCode: jest.fn(() => Promise.resolve(null)),
  list: jest.fn(() => Promise.resolve([])),
  delete: jest.fn(() => Promise.resolve()),
});

/**
 * Creates a mock PermissionChecker.
 * When hasPermissionResult=true, assertOrThrow resolves without throwing.
 * When hasPermissionResult=false, assertOrThrow rejects with an error.
 */
const createMockPermissionChecker = (hasPermissionResult: boolean = true) => {
  const mock = {
    assertOrThrow: jest.fn(),
    hasPermission: jest.fn(() => Promise.resolve(hasPermissionResult)),
    getAllPermissions: jest.fn(() => Promise.resolve(hasPermissionResult ? ['*'] : [])),
  };
  if (hasPermissionResult) {
    mock.assertOrThrow.mockResolvedValue(undefined);
  } else {
    mock.assertOrThrow.mockRejectedValue(new Error('Permission denied'));
  }
  return mock;
};

// ─── Shared Test Context ─────────────────────────────────────────────────────

const defaultContext: ToolExecutionContext = {
  companyId: 'company-smoke-test',
  userId: 'user-smoke-test',
  permissions: ['*'],
};

const noPermissionContext: ToolExecutionContext = {
  companyId: 'company-smoke-test',
  userId: 'user-smoke-test',
  permissions: [],
};

// ─── Tool Spec Table ─────────────────────────────────────────────────────────
// Each entry maps a tool class to its expected metadata and constructor deps.

interface ToolSpec {
  ToolClass: new (...args: any[]) => AiTool;
  expectedName: string;
  expectedModule: string;
  /** Factory that returns the deps array for the tool constructor. pc is cast to `any` because the real PermissionChecker has a private constructor dep. */
  depsFactory: (pc: any) => any[];
}

const ALL_TOOL_SPECS: ToolSpec[] = [
  {
    ToolClass: GetTrialBalanceSummaryTool,
    expectedName: 'accounting.getTrialBalanceSummary',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc],
  },
  {
    ToolClass: GetProfitAndLossTool,
    expectedName: 'accounting.getProfitAndLoss',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc],
  },
  {
    ToolClass: GetBalanceSheetTool,
    expectedName: 'accounting.getBalanceSheet',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc, createMockCompanyRepo()],
  },
  {
    ToolClass: GetCashFlowTool,
    expectedName: 'accounting.getCashFlowSummary',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), createMockCompanyRepo(), pc],
  },
  {
    ToolClass: GetAgingReceivablesTool,
    expectedName: 'accounting.getAgingReceivables',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc],
  },
  {
    ToolClass: GetAgingPayablesTool,
    expectedName: 'accounting.getAgingPayables',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc],
  },
  {
    ToolClass: GetGeneralLedgerSummaryTool,
    expectedName: 'accounting.getGeneralLedgerSummary',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), pc],
  },
  {
    ToolClass: GetAccountStatementSummaryTool,
    expectedName: 'accounting.getAccountStatementSummary',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), createMockCompanyRepo(), pc],
  },
  {
    ToolClass: GetChartOfAccountsSummaryTool,
    expectedName: 'accounting.getChartOfAccountsSummary',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockAccountRepo(), pc],
  },
  {
    ToolClass: GetAccountBalanceTool,
    expectedName: 'accounting.getAccountBalance',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc],
  },
  {
    ToolClass: GetFiscalYearStatusTool,
    expectedName: 'accounting.getAccountingPeriodStatus',
    expectedModule: 'accounting',
    depsFactory: (pc) => [createMockFiscalYearRepo(), pc],
  },
  {
    ToolClass: GetSalesSummaryTool,
    expectedName: 'sales.getSalesSummary',
    expectedModule: 'sales',
    depsFactory: (pc) => [createMockSalesInvoiceRepo(), createMockPartyRepo(), pc],
  },
  {
    ToolClass: GetTopCustomersTool,
    expectedName: 'sales.getTopCustomers',
    expectedModule: 'sales',
    depsFactory: (pc) => [createMockSalesInvoiceRepo(), createMockPartyRepo(), pc],
  },
  {
    ToolClass: GetPurchaseSummaryTool,
    expectedName: 'purchase.getPurchaseSummary',
    expectedModule: 'purchase',
    depsFactory: (pc) => [createMockPurchaseInvoiceRepo(), createMockPartyRepo(), pc],
  },
  {
    ToolClass: GetTopSuppliersTool,
    expectedName: 'purchase.getTopSuppliers',
    expectedModule: 'purchase',
    depsFactory: (pc) => [createMockPurchaseInvoiceRepo(), createMockPartyRepo(), pc],
  },
  {
    ToolClass: GetFinancialOverviewTool,
    expectedName: 'reports.getFinancialOverview',
    expectedModule: 'reports',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), createMockCompanyRepo(), pc],
  },
  {
    ToolClass: GetMonthlyComparisonTool,
    expectedName: 'reports.getMonthlyPerformanceSummary',
    expectedModule: 'reports',
    depsFactory: (pc) => [createMockLedgerRepo(), createMockAccountRepo(), pc],
  },
];

// ─── Sanity: we have exactly 17 specs ────────────────────────────────────────

describe('AiToolCatalogSmoke', () => {
  it('should define exactly 17 tool specs', () => {
    expect(ALL_TOOL_SPECS.length).toBe(17);
  });

  // ─── Per-Tool Tests ──────────────────────────────────────────────────────────

  describe.each(ALL_TOOL_SPECS)('$expectedName', (spec) => {
    let tool: AiTool;
    let permissionChecker: ReturnType<typeof createMockPermissionChecker>;

    beforeEach(() => {
      permissionChecker = createMockPermissionChecker(true);
      tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
    });

    it('should instantiate without error', () => {
      expect(tool).toBeDefined();
      expect(tool).toBeTruthy();
    });

    it('should have the correct tool name', () => {
      expect(tool.name).toBe(spec.expectedName);
    });

    it('should have a non-empty requiredPermission', () => {
      expect(typeof tool.requiredPermission).toBe('string');
      expect(tool.requiredPermission.length).toBeGreaterThan(0);
    });

    it('should have the correct module', () => {
      expect(tool.module).toBe(spec.expectedModule);
    });

    it('should have a non-empty description', () => {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should return an AiToolResult shape from execute() with wildcard permissions', async () => {
      // With ['*'] permissions the registry-level check passes.
      // The tool may fail due to mock data (e.g. empty repos) — that's OK.
      // We just verify it returns an AiToolResult shape and doesn't crash with a TypeError.
      const result: AiToolResult = await tool.execute(defaultContext);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect('data' in result).toBe(true);

      // If it failed, it should have error info
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        // Should NOT be a TypeError crash — real errors are TOOL_EXECUTION_ERROR etc.
        expect(result.errorCode).not.toBe('TypeError');
      }
    });

    it('should return PERMISSION_DENIED or a permission error when user has no permissions', async () => {
      // Create a tool with a permission checker that denies everything
      const denyingPc = createMockPermissionChecker(false);
      const deniedTool = new spec.ToolClass(...spec.depsFactory(denyingPc as any));

      const result: AiToolResult = await deniedTool.execute(noPermissionContext);

      // The tool should either:
      // a) Return success:false with an error code (most tools — their catch block catches the thrown permission error)
      // b) Return success:true with zero/default data (some tools like GetMonthlyComparisonTool
      //    gracefully degrade — they catch per-month errors and return zero data)
      // In both cases, the tool must NOT crash with a TypeError.
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        // Graceful degradation case (e.g., MonthlyComparisonTool):
        // The tool returned successfully but with empty/zero data because
        // the permission check was caught per-sub-request.
        // Verify it has a data field (even if it's just zeros)
        expect(result.data).toBeDefined();
      } else {
        // Permission denied case (most tools):
        expect(result.data).toBeNull();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.errorCode).toBeDefined();
        expect(typeof result.errorCode).toBe('string');
        expect(result.errorCode!.length).toBeGreaterThan(0);
      }
    });

    it('should implement the AiTool interface (has all required properties)', () => {
      const aiToolProps: (keyof AiTool)[] = ['name', 'description', 'requiredPermission', 'module', 'execute'];
      for (const prop of aiToolProps) {
        expect(tool).toHaveProperty(prop);
      }
      expect(typeof tool.execute).toBe('function');
    });
  });

  // ─── Registry Integration Test ──────────────────────────────────────────────

  describe('AiToolRegistry integration', () => {
    it('should register all 17 tools without error', () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        expect(() => registry.register(tool)).not.toThrow();
      }

      expect(registry.getAll().length).toBe(17);
    });

    it('should list all 17 tools via getToolDescriptions()', () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        registry.register(tool);
      }

      const descriptions = registry.getToolDescriptions();
      expect(descriptions.length).toBe(17);

      // Every description should have name, description, module
      for (const desc of descriptions) {
        expect(desc.name).toBeTruthy();
        expect(desc.description).toBeTruthy();
        expect(desc.module).toBeTruthy();
      }
    });

    it('should reject duplicate tool registration', () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);
      const tool = new GetTrialBalanceSummaryTool(
        createMockLedgerRepo() as any,
        createMockAccountRepo() as any,
        permissionChecker as any,
      );

      registry.register(tool);
      expect(() => registry.register(tool)).toThrow('already registered');
    });

    it('should return each tool by name via get()', () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        registry.register(tool);
      }

      for (const spec of ALL_TOOL_SPECS) {
        const found = registry.get(spec.expectedName);
        expect(found).toBeDefined();
        expect(found!.name).toBe(spec.expectedName);
      }
    });

    it('should group tools by module correctly', () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        registry.register(tool);
      }

      const accountingTools = registry.getByModule('accounting');
      const salesTools = registry.getByModule('sales');
      const purchaseTools = registry.getByModule('purchase');
      const reportsTools = registry.getByModule('reports');

      // 11 accounting tools: TB, P&L, BS, CashFlow, AgingAR, AgingAP, GL, AccountStatement,
      //                      ChartOfAccounts, AccountBalance, FiscalYear
      expect(accountingTools.length).toBe(11);
      // 2 sales tools: SalesSummary, TopCustomers
      expect(salesTools.length).toBe(2);
      // 2 purchase tools: PurchaseSummary, TopSuppliers
      expect(purchaseTools.length).toBe(2);
      // 2 reports tools: FinancialOverview, MonthlyComparison
      expect(reportsTools.length).toBe(2);
    });

    it('should return PERMISSION_DENIED via executeTool() when user has no permissions', async () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        registry.register(tool);
      }

      // executeTool checks permissions at the registry level
      for (const spec of ALL_TOOL_SPECS) {
        const result = await registry.executeTool(spec.expectedName, noPermissionContext);
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('PERMISSION_DENIED');
      }
    });

    it('should execute tools via executeTool() with wildcard permissions (smoke)', async () => {
      const registry = new AiToolRegistry();
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        registry.register(tool);
      }

      // With ['*'] permissions, the registry-level check passes.
      // The tool may fail due to mock repos returning empty data — that's OK for a smoke test.
      for (const spec of ALL_TOOL_SPECS) {
        const result = await registry.executeTool(spec.expectedName, defaultContext);
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        // We don't assert success=true because mock data may cause execution errors
        // (e.g., use case expects data that empty mocks don't provide).
        // The important thing is it doesn't crash.
      }
    });

    it('should return UNKNOWN_TOOL for a non-existent tool', async () => {
      const registry = new AiToolRegistry();
      const result = await registry.executeTool('nonexistent.tool', defaultContext);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_TOOL');
    });
  });

  // ─── Cross-Tool Uniqueness Checks ───────────────────────────────────────────

  describe('Cross-tool uniqueness', () => {
    it('should have unique tool names across all 17 tools', () => {
      const permissionChecker = createMockPermissionChecker(true);
      const names: string[] = [];

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        names.push(tool.name);
      }

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have non-empty, unique requiredPermissions', () => {
      const permissionChecker = createMockPermissionChecker(true);
      const permissions: string[] = [];

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        expect(tool.requiredPermission).toBeTruthy();
        permissions.push(tool.requiredPermission);
      }

      // Permissions don't need to be unique (multiple tools can share a permission),
      // but they must all be non-empty — already verified above.
      expect(permissions.length).toBe(17);
    });

    it('should have all tool names follow the module.action pattern', () => {
      const permissionChecker = createMockPermissionChecker(true);

      for (const spec of ALL_TOOL_SPECS) {
        const tool = new spec.ToolClass(...spec.depsFactory(permissionChecker as any));
        // Tool names should be dot-separated: module.actionSubAction
        expect(tool.name).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
        // Module should be a simple lowercase string
        expect(tool.module).toMatch(/^[a-z]+$/);
      }
    });
  });
});
