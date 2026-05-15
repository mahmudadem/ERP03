/**
 * AI Tool Catalog Domain Entity Tests
 *
 * Verifies:
 * 1. AiToolDefinition creation, isExecutable, isBlocked
 * 2. AiToolEnablementPolicy creation, isEnabledForContext, DENY precedence
 * 3. AiModelToolPolicy creation, isToolAllowed, write tools ALWAYS blocked
 * 4. JSON serialization/deserialization round-trips
 */

import {
  AiToolDefinition,
  AiToolCategory,
  AiToolMode,
  AiToolStatus,
  AiToolRiskLevel,
  AiToolDataSensitivity,
} from '../../../domain/ai-assistant/entities/AiToolDefinition';
import { AiToolEnablementPolicy } from '../../../domain/ai-assistant/entities/AiToolEnablementPolicy';
import { AiModelToolPolicy, AiToolPolicy } from '../../../domain/ai-assistant/entities/AiModelToolPolicy';

describe('AiToolDefinition', () => {
  it('should create a read-only active tool definition', () => {
    const tool = new AiToolDefinition(
      'accounting.getTrialBalanceSummary',
      'accounting.getTrialBalanceSummary',
      'accounting',
      'accounting',
      'Get trial balance summary',
      'accounting' as AiToolCategory,
      'active' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.reports.trialBalance.view'],
      ['accounting'],
      {},
      {},
      true,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
    );

    expect(tool.name).toBe('accounting.getTrialBalanceSummary');
    expect(tool.moduleId).toBe('accounting');
    expect(tool.mode).toBe('read-only');
    expect(tool.status).toBe('active');
    expect(tool.isExecutable).toBe(true);
    expect(tool.isBlocked).toBe(false);
  });

  it('should mark write tools as blocked and non-executable', () => {
    const tool = new AiToolDefinition(
      'BLOCKED.create',
      'BLOCKED.create',
      'BLOCKED',
      'BLOCKED',
      'BLOCKED — AI must never create records',
      'BLOCKED' as AiToolCategory,
      'disabled' as AiToolStatus,
      'write' as AiToolMode,
      [],
      [],
      {},
      {},
      false,
      false,
      false,
      'blocked' as AiToolRiskLevel,
      'high' as AiToolDataSensitivity,
      'Write tools are permanently blocked for safety.',
    );

    expect(tool.isExecutable).toBe(false);
    expect(tool.isBlocked).toBe(true);
  });

  it('should mark unavailable tools as non-executable', () => {
    const tool = new AiToolDefinition(
      'crm.getCustomerProfile',
      'crm.getCustomerProfile',
      'crm',
      'crm',
      'Get customer profile',
      'crm' as AiToolCategory,
      'unavailable' as AiToolStatus,
      'read-only' as AiToolMode,
      ['crm.customers.view'],
      ['crm'],
      {},
      {},
      false,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
      'CRM module not yet implemented',
    );

    expect(tool.isExecutable).toBe(false);
    expect(tool.isBlocked).toBe(false);
    expect(tool.unavailabilityReason).toBe('CRM module not yet implemented');
  });

  it('should mark proposal tools as non-executable when not active', () => {
    const tool = new AiToolDefinition(
      'accounting.proposeVoucherDraft',
      'accounting.proposeVoucherDraft',
      'accounting',
      'accounting',
      'AI proposes a voucher draft',
      'accounting' as AiToolCategory,
      'disabled' as AiToolStatus,
      'proposal' as AiToolMode,
      ['accounting.vouchers.create'],
      ['accounting'],
      {},
      {},
      false,
      true,
      true,
      'high' as AiToolRiskLevel,
      'high' as AiToolDataSensitivity,
    );

    expect(tool.isExecutable).toBe(false);
    expect(tool.mode).toBe('proposal');
  });

  it('should serialize to JSON and deserialize back', () => {
    const tool = new AiToolDefinition(
      'accounting.getProfitAndLoss',
      'accounting.getProfitAndLoss',
      'accounting',
      'accounting',
      'Get P&L summary',
      'accounting' as AiToolCategory,
      'active' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.reports.profitAndLoss.view'],
      ['accounting'],
      { type: 'object' },
      { type: 'object' },
      true,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
    );

    const json = tool.toJSON();
    expect(json.name).toBe('accounting.getProfitAndLoss');
    expect(json.readOnly).toBe(true);
    expect(json.isExecutable).toBe(true);
    expect(json.isBlocked).toBe(false);

    const restored = AiToolDefinition.fromJSON(json);
    expect(restored.name).toBe(tool.name);
    expect(restored.mode).toBe(tool.mode);
    expect(restored.status).toBe(tool.status);
  });

  it('should mark deprecated tools as non-executable', () => {
    const tool = new AiToolDefinition(
      'old.tool',
      'old.tool',
      'accounting',
      'accounting',
      'Deprecated tool',
      'accounting' as AiToolCategory,
      'deprecated' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.view'],
      ['accounting'],
      {},
      {},
      false,
      false,
      true,
      'low' as AiToolRiskLevel,
      'low' as AiToolDataSensitivity,
    );

    expect(tool.isExecutable).toBe(false);
    expect(tool.status).toBe('deprecated');
  });

  it('should default implemented to false', () => {
    const tool = new AiToolDefinition(
      'accounting.searchAccounts',
      'accounting.searchAccounts',
      'accounting',
      'accounting',
      'Search accounts',
      'accounting' as AiToolCategory,
      'active' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.accounts.view'],
      ['accounting'],
      {},
      {},
      true,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
    );

    expect(tool.implemented).toBe(false);
  });

  it('should set implemented to true explicitly', () => {
    const tool = new AiToolDefinition(
      'accounting.getTrialBalanceSummary',
      'accounting.getTrialBalanceSummary',
      'accounting',
      'accounting',
      'Get trial balance summary',
      'accounting' as AiToolCategory,
      'active' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.reports.trialBalance.view'],
      ['accounting'],
      {},
      {},
      true,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
      undefined,
      true,
    );

    expect(tool.implemented).toBe(true);
  });

  it('should include implemented in toJSON output', () => {
    const tool = new AiToolDefinition(
      'accounting.getProfitAndLoss',
      'accounting.getProfitAndLoss',
      'accounting',
      'accounting',
      'Get P&L',
      'accounting' as AiToolCategory,
      'active' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.reports.profitAndLoss.view'],
      ['accounting'],
      {},
      {},
      true,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
      undefined,
      true,
    );

    const json = tool.toJSON();
    expect(json.implemented).toBe(true);
  });

  it('should round-trip implemented field through fromJSON', () => {
    const tool = new AiToolDefinition(
      'accounting.getCashFlowSummary',
      'accounting.getCashFlowSummary',
      'accounting',
      'accounting',
      'Get cash flow',
      'accounting' as AiToolCategory,
      'active' as AiToolStatus,
      'read-only' as AiToolMode,
      ['accounting.reports.cashFlow.view'],
      ['accounting'],
      {},
      {},
      true,
      true,
      true,
      'low' as AiToolRiskLevel,
      'medium' as AiToolDataSensitivity,
      undefined,
      true,
    );

    const json = tool.toJSON();
    const restored = AiToolDefinition.fromJSON(json);
    expect(restored.implemented).toBe(true);
  });

  it('should default implemented to false in fromJSON when missing', () => {
    const json = {
      id: 'test.tool',
      name: 'test.tool',
      namespace: 'accounting',
      moduleId: 'accounting',
      description: 'Test tool',
      category: 'accounting',
      status: 'active',
      mode: 'read-only',
      requiredPermissions: [],
      requiredModules: ['accounting'],
      inputSchema: {},
      outputSchema: {},
      enabledByDefault: true,
      supportsChatInvocation: true,
      supportsManualExecution: true,
      riskLevel: 'low',
      dataSensitivity: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const restored = AiToolDefinition.fromJSON(json);
    expect(restored.implemented).toBe(false);
  });
});

describe('AiToolEnablementPolicy', () => {
  it('should allow tool when globally enabled and no restrictions', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');

    expect(policy.globallyEnabled).toBe(true);
    expect(policy.isEnabledForContext({})).toBe(true);
  });

  it('should deny tool when globally disabled', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
    policy.globallyEnabled = false;

    expect(policy.isEnabledForContext({})).toBe(false);
  });

  it('should deny for disabled plan even if plan allow list is empty', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
    policy.disabledForPlans = ['starter'];

    expect(policy.isEnabledForContext({ plan: 'starter' })).toBe(false);
  });

  it('should deny for disabled company even if globally enabled', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
    policy.disabledForCompanies = ['company-123'];

    expect(policy.isEnabledForContext({ companyId: 'company-123' })).toBe(false);
  });

  it('should deny for disabled provider', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
    policy.disabledForProviders = ['mock'];

    expect(policy.isEnabledForContext({ provider: 'mock' })).toBe(false);
  });

  it('should deny for disabled model', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
    policy.disabledForModels = ['gpt-3.5-turbo'];

    expect(policy.isEnabledForContext({ model: 'gpt-3.5-turbo' })).toBe(false);
  });

  it('should deny for disabled role', () => {
    const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
    policy.disabledForRoles = ['viewer'];

    expect(policy.isEnabledForContext({ roles: ['viewer'] })).toBe(false);
  });

  it('should serialize and deserialize', () => {
    const policy = new AiToolEnablementPolicy('test.tool');
    policy.globallyEnabled = true;
    policy.enabledForPlans = ['professional', 'enterprise'];
    policy.disabledForPlans = ['starter'];
    policy.maxCallsPerMessage = 3;

    const json = policy.toJSON();
    expect(json.toolId).toBe('test.tool');
    expect(json.maxCallsPerMessage).toBe(3);

    const restored = AiToolEnablementPolicy.fromJSON(json);
    expect(restored.toolId).toBe('test.tool');
    expect(restored.maxCallsPerMessage).toBe(3);
    expect(restored.enabledForPlans).toEqual(['professional', 'enterprise']);
  });

  it('should respect enabledForPlans when set', () => {
    const policy = new AiToolEnablementPolicy('test.tool');
    policy.enabledForPlans = ['professional', 'enterprise'];

    expect(policy.isEnabledForContext({ plan: 'professional' })).toBe(true);
    expect(policy.isEnabledForContext({ plan: 'starter' })).toBe(false);
    expect(policy.isEnabledForContext({})).toBe(true); // No plan specified = allowed
  });

  it('should respect enabledForModules', () => {
    const policy = new AiToolEnablementPolicy('test.tool');
    policy.enabledForModules = ['accounting'];

    expect(policy.isEnabledForContext({ modules: ['accounting', 'inventory'] })).toBe(true);
    expect(policy.isEnabledForContext({ modules: ['inventory'] })).toBe(false);
  });
});

describe('AiModelToolPolicy', () => {
  it('should allow read-only tools by default', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');

    expect(policy.allowReadOnlyTools).toBe(true);
    expect(policy.allowProposalTools).toBe(false);
    expect(policy.allowWriteTools).toBe(false);
    expect(policy.isToolAllowed('accounting.getTrialBalanceSummary', 'read-only')).toBe(true);
  });

  it('should ALWAYS block write tools regardless of policy', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');
    policy.allowWriteTools = true; // Even if someone tries to enable this

    // isToolAllowed still blocks write tools
    expect(policy.isToolAllowed('accounting.createVoucher', 'write')).toBe(false);
  });

  it('should block tools in the disabled list', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');
    policy.disabledTools = ['accounting.getTrialBalanceSummary'];

    expect(policy.isToolAllowed('accounting.getTrialBalanceSummary', 'read-only')).toBe(false);
  });

  it('should allow tools in the allowed list', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');
    policy.allowedTools = ['accounting.getTrialBalanceSummary'];

    expect(policy.isToolAllowed('accounting.getTrialBalanceSummary', 'read-only')).toBe(true);
  });

  it('should block proposal tools by default', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');

    expect(policy.isToolAllowed('accounting.proposeVoucherDraft', 'proposal')).toBe(false);
  });

  it('should allow proposal tools when explicitly enabled', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');
    policy.allowProposalTools = true;

    expect(policy.isToolAllowed('accounting.proposeVoucherDraft', 'proposal')).toBe(true);
  });

  it('should block all tools when policy is none', () => {
    const policy = new AiModelToolPolicy('mock:mock', '', 'mock', 'mock');
    policy.defaultToolPolicy = 'none';

    expect(policy.isToolAllowed('accounting.getTrialBalanceSummary', 'read-only')).toBe(false);
  });

  it('should serialize and deserialize', () => {
    const policy = new AiModelToolPolicy('openai:gpt-4o', 'config-1', 'openai_compatible', 'gpt-4o');
    policy.allowedTools = ['accounting.getTrialBalanceSummary'];
    policy.maxToolCallsPerMessage = 5;

    const json = policy.toJSON();
    expect(json.id).toBe('openai:gpt-4o');
    expect(json.allowWriteTools).toBe(false);
    expect(json.maxToolCallsPerMessage).toBe(5);

    const restored = AiModelToolPolicy.fromJSON(json);
    expect(restored.id).toBe('openai:gpt-4o');
    expect(restored.allowWriteTools).toBe(false);
    expect(restored.maxToolCallsPerMessage).toBe(5);
  });
});

describe('AiToolCatalogSeed', () => {
  it('should have no write tools that are executable', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const writeTools = AI_TOOL_CATALOG.filter((t: AiToolDefinition) => t.mode === 'write');
    expect(writeTools.length).toBeGreaterThan(0); // There ARE write pattern entries

    const executableWriteTools = writeTools.filter((t: AiToolDefinition) => t.isExecutable);
    expect(executableWriteTools.length).toBe(0); // But NONE should be executable
  });

  it('should have BLOCKED entries that are blocked', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const blocked = AI_TOOL_CATALOG.filter((t: AiToolDefinition) => t.isBlocked);
    expect(blocked.length).toBeGreaterThan(0);

    blocked.forEach((t: AiToolDefinition) => {
      expect(t.riskLevel).toBe('blocked');
      expect(t.mode).toBe('write');
      expect(t.isExecutable).toBe(false);
    });
  });

  it('should have active read-only tools that are executable', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const activeReadOnly = AI_TOOL_CATALOG.filter(
      (t: AiToolDefinition) => t.status === 'active' && t.mode === 'read-only'
    );
    expect(activeReadOnly.length).toBeGreaterThan(0);

    activeReadOnly.forEach((t: AiToolDefinition) => {
      expect(t.isExecutable).toBe(true);
    });
  });

  it('should have all active tools with required permissions', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const activeTools = AI_TOOL_CATALOG.filter(
      (t: AiToolDefinition) => t.status === 'active' && t.mode === 'read-only'
    );

    activeTools.forEach((t: AiToolDefinition) => {
      expect(t.requiredPermissions.length).toBeGreaterThan(0);
      expect(t.moduleId).toBeTruthy();
    });
  });

  it('should have unique tool names', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const names = AI_TOOL_CATALOG.map((t: AiToolDefinition) => t.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('should have all unavailable tools with a reason', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const unavailable = AI_TOOL_CATALOG.filter(
      (t: AiToolDefinition) => t.status === 'unavailable'
    );
    expect(unavailable.length).toBeGreaterThan(0);

    unavailable.forEach((t: AiToolDefinition) => {
      expect(t.unavailabilityReason).toBeTruthy();
    });
  });

  it('should mark implemented tools with implemented=true', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const implementedTools = AI_TOOL_CATALOG.filter((t: AiToolDefinition) => t.implemented === true);
    expect(implementedTools.length).toBe(25);

    const implementedNames = implementedTools.map((t: AiToolDefinition) => t.name);
    expect(implementedNames).toContain('accounting.getTrialBalanceSummary');
    expect(implementedNames).toContain('accounting.getProfitAndLoss');
    expect(implementedNames).toContain('accounting.getBalanceSheet');
    expect(implementedNames).toContain('reports.getFinancialOverview');
    expect(implementedNames).toContain('sales.getSalesSummary');
    expect(implementedNames).toContain('purchase.getPurchaseSummary');
    expect(implementedNames).toContain('reports.profitAndLoss');
    expect(implementedNames).toContain('reports.trialBalance');
    expect(implementedNames).toContain('reports.balanceSheet');
    expect(implementedNames).toContain('reports.cashFlow');
    expect(implementedNames).toContain('reports.generalLedger');
    expect(implementedNames).toContain('reports.accountStatement');
    expect(implementedNames).toContain('reports.agingReceivables');
    expect(implementedNames).toContain('reports.agingPayables');
  });

  it('should mark non-implemented tools with implemented=false', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const plannedTools = AI_TOOL_CATALOG.filter((t: AiToolDefinition) => t.implemented !== true);
    expect(plannedTools.length).toBeGreaterThan(0);

    plannedTools.forEach((t: AiToolDefinition) => {
      expect(t.implemented).toBe(false);
    });
  });

  it('should NOT mark blocked/unavailable tools as implemented', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const blocked = AI_TOOL_CATALOG.filter((t: AiToolDefinition) => t.isBlocked);
    blocked.forEach((t: AiToolDefinition) => {
      expect(t.implemented).toBe(false);
    });

    const unavailable = AI_TOOL_CATALOG.filter((t: AiToolDefinition) => t.status === 'unavailable');
    unavailable.forEach((t: AiToolDefinition) => {
      expect(t.implemented).toBe(false);
    });
  });
});

describe('Tool Chat Keywords', () => {
  it('should have chatKeywords for all implemented tools', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const implementedTools = AI_TOOL_CATALOG.filter((t: any) => t.implemented === true);
    expect(implementedTools.length).toBeGreaterThanOrEqual(17);

    implementedTools.forEach((tool: any) => {
      expect(tool.chatKeywords).toBeTruthy();
      expect(Array.isArray(tool.chatKeywords)).toBe(true);
      expect(tool.chatKeywords.length).toBeGreaterThan(0);
    });
  });

  it('should NOT have chatKeywords for non-implemented tools', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const nonImplementedTools = AI_TOOL_CATALOG.filter((t: any) => t.implemented !== true);
    nonImplementedTools.forEach((tool: any) => {
      expect(!tool.chatKeywords || tool.chatKeywords.length === 0).toBe(true);
    });
  });

  it('should have Arabic keywords for accounting reports', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const tb = AI_TOOL_CATALOG.find((t: any) => t.name === 'accounting.getTrialBalanceSummary');
    expect(tb).toBeTruthy();
    expect(tb.chatKeywords.some((k: string) => /[\u0600-\u06FF]/.test(k))).toBe(true);
  });

  it('should have Turkish keywords for accounting reports', () => {
    const { AI_TOOL_CATALOG } = require('../../../application/ai-assistant/catalog/AiToolCatalogSeed');

    const tb = AI_TOOL_CATALOG.find((t: any) => t.name === 'accounting.getTrialBalanceSummary');
    expect(tb).toBeTruthy();
    // Turkish keywords contain special chars like ç, ş, ö, ü, ğ, ı
    expect(tb.chatKeywords.some((k: string) => /[çşöüğıİ]/.test(k))).toBe(true);
  });
});