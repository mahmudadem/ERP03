/**
 * AI Runtime Guard + v2 runtime security tests.
 *
 * These tests verify that model-requested tool calls are treated as untrusted
 * requests and must pass the backend runtime guard before any tool executes.
 */

import { AiRuntimeGuard } from '../../../application/ai-assistant/services/AiRuntimeGuard';
import { AiAuditService } from '../../../application/ai-assistant/services/AiAuditService';
import { AiModelCapabilityCatalog } from '../../../application/ai-assistant/services/AiModelCapabilityCatalog';
import { AiToolCallingOrchestrator } from '../../../application/ai-assistant/services/AiToolCallingOrchestrator';
import { AiToolRegistry } from '../../../application/ai-assistant/services/AiToolRegistry';
import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { IAuditLogRepository } from '../../../repository/interfaces/system/IAuditLogRepository';
import { AuditLog } from '../../../domain/system/entities/AuditLog';

class TrialBalanceTool implements AiTool {
  readonly name = 'accounting.getTrialBalanceSummary';
  readonly description = 'Get a Trial Balance summary with totals.';
  readonly requiredPermission = 'accounting.reports.trialBalance.view';
  readonly module = 'accounting';

  async execute(context: ToolExecutionContext): Promise<AiToolResult> {
    return {
      success: true,
      data: {
        companyId: context.companyId,
        totalDebit: 100,
        totalCredit: 100,
        isBalanced: true,
      },
    };
  }
}

const permissionChecker = (allowed = true, permissions: string[] = ['*']) => ({
  hasPermission: jest.fn(() => Promise.resolve(allowed)),
  getAllPermissions: jest.fn(() => Promise.resolve(permissions)),
});

describe('AiRuntimeGuard', () => {
  let registry: AiToolRegistry;

  beforeEach(() => {
    registry = new AiToolRegistry([new TrialBalanceTool()]);
  });

  it('rejects unregistered tools requested by the model', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: ['accounting.getTrialBalanceSummary'],
      providerModel: 'openai_compatible/gpt-4o',
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'runSql',
      arguments: { sql: 'select * from users' },
    }, new Map());

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('TOOL_NOT_FOUND');
  });

  it('rejects disabled/not-allowed tools outside the aiRun allowed snapshot', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: [],
      providerModel: 'openai_compatible/gpt-4o',
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'accounting_getTrialBalanceSummary',
      arguments: {},
    }, new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]));

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('TOOL_NOT_ALLOWED_FOR_RUN');
  });

  it('rejects tool calls when the run certification gate is closed', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: ['accounting.getTrialBalanceSummary'],
      providerModel: 'openai_compatible/gpt-4o',
      certification: {
        allowed: false,
        code: 'MODEL_PROFILE_NOT_CERTIFIED',
        reason: 'This model profile is not certified for this ERP module/workflow. Please select a certified profile or run company certification.',
      },
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'accounting_getTrialBalanceSummary',
      arguments: {},
    }, new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]));

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('MODEL_PROFILE_NOT_CERTIFIED');
  });

  it('rejects tools outside the current user permissions', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(false, []) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: ['accounting.getTrialBalanceSummary'],
      providerModel: 'openai_compatible/gpt-4o',
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'accounting_getTrialBalanceSummary',
      arguments: {},
    }, new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]));

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('PERMISSION_DENIED');
  });

  it('rejects model-supplied companyId/userId spoofing', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'trusted-company',
      userId: 'trusted-user',
      conversationId: 'conv-1',
      allowedToolIds: ['accounting.getTrialBalanceSummary'],
      providerModel: 'openai_compatible/gpt-4o',
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'accounting_getTrialBalanceSummary',
      arguments: { companyId: 'evil-company', userId: 'evil-user' },
    }, new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]));

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('MODEL_SUPPLIED_IDENTITY_REJECTED');
  });

  it('blocks write operations from direct execution', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: ['BLOCKED.create'],
      providerModel: 'openai_compatible/gpt-4o',
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'BLOCKED_create',
      arguments: {},
    }, new Map([['BLOCKED_create', 'BLOCKED.create']]));

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('OPERATION_TYPE_BLOCKED');
    expect(decision.operationType).toBe('CREATE');
  });

  it('rejects invalid tool argument schema payloads', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: ['accounting.getTrialBalanceSummary'],
      providerModel: 'openai_compatible/gpt-4o',
    });

    const decision = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1',
      name: 'accounting_getTrialBalanceSummary',
      arguments: { asOfDate: 123, unexpected: true },
    }, new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]));

    expect(decision.approved).toBe(false);
    expect(decision.rejectionCode).toBe('SCHEMA_VALIDATION_FAILED');
    expect(decision.schemaValidationErrors?.join(' ')).toContain('asOfDate');
  });

  it('enforces max tool calls per aiRun', async () => {
    const guard = new AiRuntimeGuard(registry, permissionChecker(true) as any);
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: ['accounting.getTrialBalanceSummary'],
      providerModel: 'openai_compatible/gpt-4o',
      maxToolCalls: 1,
    });
    const mapping = new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]);

    const first = await guard.validateToolCall(run.aiRunId, {
      id: 'call-1', name: 'accounting_getTrialBalanceSummary', arguments: {},
    }, mapping);
    const second = await guard.validateToolCall(run.aiRunId, {
      id: 'call-2', name: 'accounting_getTrialBalanceSummary', arguments: {},
    }, mapping);

    expect(first.approved).toBe(true);
    expect(second.approved).toBe(false);
    expect(second.rejectionCode).toBe('MAX_TOOL_CALLS_EXCEEDED');
  });

  it('executes approved structured read-only tool calls using trusted tenant context', async () => {
    const checker = permissionChecker(true) as any;
    const guard = new AiRuntimeGuard(registry, checker);
    const orchestrator = new AiToolCallingOrchestrator(registry, checker, guard);
    const allowed = await orchestrator.buildAllowedToolContracts('user-1', 'company-1');
    const run = guard.createRun({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      allowedToolIds: allowed.allowedToolIds,
      providerModel: 'openai_compatible/gpt-4o',
    });

    const results = await orchestrator.executeStructuredToolCalls(
      run.aiRunId,
      [{ id: 'call-1', name: 'accounting_getTrialBalanceSummary', arguments: {} }],
      allowed.nameMapping,
      'company-1',
      'user-1',
    );

    expect(results).toHaveLength(1);
    expect(results[0].approved).toBe(true);
    expect(results[0].result?.success).toBe(true);
    expect(results[0].result?.data?.companyId).toBe('company-1');
  });
});

describe('AiModelCapabilityCatalog', () => {
  it('marks custom untested models with warnings and text-only mode', () => {
    const profile = AiModelCapabilityCatalog.getProfile('openai_compatible', 'unknown-custom-model');

    expect(profile.status).toBe('custom');
    expect(profile.warningLevel).toBe('danger');
    expect(profile.textOnlyMode).toBe(true);
    expect(profile.supportsToolCalling).toBe(false);
    expect(profile.warningMessage).toContain('unknown');
  });

  it('recognizes provider-prefixed OpenAI-compatible model aliases', () => {
    const profile = AiModelCapabilityCatalog.getProfile('openai_compatible', 'openai/gpt-4o-mini');

    expect(profile.status).toBe('recommended');
    expect(profile.supportsToolCalling).toBe(true);
    expect(profile.supportsStructuredJson).toBe(true);
    expect(profile.textOnlyMode).toBe(false);
    expect(profile.warningLevel).toBe('none');
    expect(AiModelCapabilityCatalog.supportsToolCalling('openai_compatible', 'openai/gpt-4o-mini')).toBe(true);
  });

  it('registers requested free models as known experimental text-plan profiles', () => {
    const models = [
      'google/gemma-4-31b-it:free',
      'openai/gpt-oss-20b:free',
      'z-ai/glm-4.5-air:free',
      'tencent/hy3-preview:free',
    ];

    for (const model of models) {
      const profile = AiModelCapabilityCatalog.getProfile('openai_compatible', model);

      expect(profile.status).toBe('experimental');
      expect(profile.warningLevel).not.toBe('danger');
      expect(profile.supportsToolCalling).toBe(false);
      expect(profile.supportsStructuredJson).toBe(true);
      expect(profile.textOnlyMode).toBe(true);
      expect(profile.warningMessage).toContain('ERP_TOOL_PLAN');
      expect(AiModelCapabilityCatalog.supportsToolCalling('openai_compatible', model)).toBe(false);
    }
  });

  it('marks Tencent HY3 preview as a finance/reporting test profile', () => {
    const profile = AiModelCapabilityCatalog.getProfile('openai_compatible', 'tencent/hy3-preview:free');

    expect(profile.recommendedUseCases).toContain('finance-test');
    expect(profile.recommendedUseCases).toContain('accounting-test');
    expect(profile.warningLevel).toBe('info');
  });

  it('uses provider-prefixed aliases for pattern fallback too', () => {
    const profile = AiModelCapabilityCatalog.getProfile('openai_compatible', 'anthropic/claude-3-5-sonnet');

    expect(profile.status).toBe('recommended');
    expect(profile.supportsToolCalling).toBe(true);
    expect(profile.textOnlyMode).toBe(false);
  });

  it('keeps known text-only models from using tool calling', () => {
    const profile = AiModelCapabilityCatalog.getProfile('ollama', 'llama3');

    expect(profile.textOnlyMode).toBe(true);
    expect(profile.supportsToolCalling).toBe(false);
    expect(AiModelCapabilityCatalog.supportsToolCalling('ollama', 'llama3')).toBe(false);
  });
});

describe('AiAuditService', () => {
  it('records approved and rejected tool call audit events without raw arguments', async () => {
    const logs: AuditLog[] = [];
    const repo: IAuditLogRepository = {
      log: jest.fn(async (entry: AuditLog) => { logs.push(entry); }),
      getLogs: jest.fn(async () => logs),
    };
    const audit = new AiAuditService(repo);

    await audit.log('AI_TOOL_CALL_APPROVED', {
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      aiRunId: 'run-1',
      providerModel: 'openai_compatible/gpt-4o',
      resolvedOriginalName: 'accounting.getTrialBalanceSummary',
      operationType: 'READ',
      toolCallKeys: ['asOfDate'],
    });
    await audit.log('AI_TOOL_CALL_REJECTED', {
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      aiRunId: 'run-1',
      providerModel: 'openai_compatible/gpt-4o',
      resolvedOriginalName: 'runSql',
      rejectionCode: 'TOOL_NOT_FOUND',
      rejectionReason: 'Tool not registered',
      toolCallKeys: ['sql'],
    });

    expect(repo.log).toHaveBeenCalledTimes(2);
    expect(logs.map(l => l.action)).toEqual(['AI_TOOL_CALL_APPROVED', 'AI_TOOL_CALL_REJECTED']);
    expect(logs[0].meta?.toolCallKeys).toEqual(['asOfDate']);
    expect(JSON.stringify(logs)).not.toContain('select *');
  });
});
