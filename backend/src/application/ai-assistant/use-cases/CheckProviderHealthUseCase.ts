/**
 * CheckProviderHealthUseCase - Tests AI provider connectivity and inference readiness
 *
 * This use case performs two checks:
 * 1. Network check: Calls isAvailable() to test API connectivity
 * 2. Inference check: Sends a safe prompt "Reply with only: provider-ok"
 *    to verify the model can actually generate a response
 *
 * Important:
 * - The inference check consumes real tokens (costs money for paid providers)
 * - This should be called on-demand (e.g., "Test Connection" button), not on every page load
 * - The safe prompt does NOT include any ERP data
 * - The API key is NEVER exposed in the response
 * - Errors are sanitized to prevent information leakage
 * - A cooldown of 60 seconds per company prevents abuse
 */

import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory } from '../providers/ProviderFactory';
import { ProviderError } from '../../../errors/ProviderErrors';
import { ApiError } from '../../../api/errors/ApiError';
import { AiModelCapabilityCatalog, AiModelProfile } from '../services/AiModelCapabilityCatalog';
import { IAiProvider } from '../providers/IAiProvider';
import { AiProviderToolContract } from '../../../domain/ai-assistant/tools/AiToolContract';
import { AiModelProfileUseCase } from './AiModelProfileUseCase';

export type ProviderDiagnosticStatus = 'passed' | 'failed' | 'skipped';
export type ProviderRecommendedToolMode =
  | 'native-tool-calling'
  | 'text-plan'
  | 'text-only'
  | 'unavailable';

export interface ProviderDiagnosticCheck {
  id: 'network' | 'inference' | 'nativeToolCalling' | 'textPlan';
  status: ProviderDiagnosticStatus;
  ok: boolean;
  detail?: string;
}

export interface ProviderModelProfileResult {
  provider: string;
  modelName: string;
  status: string;
  supportsToolCalling: boolean;
  supportsStructuredJson: boolean;
  textOnlyMode: boolean;
  warningLevel: string;
  warningMessage: string;
  recommendedUseCases: string[];
}

export interface NativeToolCallingDiagnostic {
  attempted: boolean;
  ok: boolean;
  supportedByProvider: boolean;
  expectedByCatalog: boolean;
  detail?: string;
}

export interface TextPlanDiagnostic {
  attempted: boolean;
  ok: boolean;
  detail?: string;
}

export interface ProviderToolDiagnostics {
  erpToolsReady: boolean;
  recommendedMode: ProviderRecommendedToolMode;
  nativeToolCalling: NativeToolCallingDiagnostic;
  textPlan: TextPlanDiagnostic;
}

export interface ProviderHealthResult {
  ready: boolean;
  networkOk: boolean;
  inferenceOk: boolean;
  provider: string;
  model: string;
  reason?: string;
  modelProfile: ProviderModelProfileResult;
  toolDiagnostics: ProviderToolDiagnostics;
  checks: ProviderDiagnosticCheck[];
}

export interface CheckProviderHealthInput {
  companyId: string;
  providerOverride?: AiProviderConfig['provider'];
  modelOverride?: string;
}

/** Cooldown period in milliseconds between health checks per company */
const HEALTH_CHECK_COOLDOWN_MS = 60_000; // 60 seconds

/** Map of companyId → last health check timestamp */
const lastHealthCheck = new Map<string, number>();

const DIAGNOSTIC_TOOL: AiProviderToolContract = {
  name: 'diagnostics_ping',
  originalName: 'diagnostics.ping',
  description: 'Diagnostic read-only ping used to verify AI tool calling compatibility.',
  whenToUse: 'Use only during model diagnostics.',
  operationType: 'READ',
  moduleId: 'ai-assistant',
  requiredPermissions: [],
  inputSchema: {
    type: 'object',
    properties: {
      probe: { type: 'string' },
    },
    required: ['probe'],
    additionalProperties: false,
  },
  parameters: {
    type: 'object',
    properties: {
      probe: { type: 'string' },
    },
    required: ['probe'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
    },
  },
  outputDescription: 'Diagnostic result only. No ERP data is read.',
  examples: ['Run AI model diagnostics'],
  safetyNotes: ['No ERP data is included. No business record is modified.'],
  safeForAutoInvoke: true,
};

const TEXT_PLAN_START = '[ERP_TOOL_PLAN]';
const TEXT_PLAN_END = '[/ERP_TOOL_PLAN]';

export class CheckProviderHealthUseCase {
  constructor(
    private settingsRepository: IAiSettingsRepository,
    private encryptionService: IEncryptionService,
    private httpClient: IHttpClient,
    private modelProfileUseCase?: AiModelProfileUseCase,
  ) {}

  async execute(companyIdOrInput: string | CheckProviderHealthInput): Promise<ProviderHealthResult> {
    const input = typeof companyIdOrInput === 'string'
      ? { companyId: companyIdOrInput }
      : companyIdOrInput;
    const { companyId } = input;
    const cooldownKey = [
      companyId,
      input.providerOverride || '',
      input.modelOverride || '',
    ].join(':');
    // Cooldown check: prevent spamming the health check endpoint
    const lastCheck = lastHealthCheck.get(cooldownKey) || 0;
    const timeSinceLastCheck = Date.now() - lastCheck;
    if (timeSinceLastCheck < HEALTH_CHECK_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((HEALTH_CHECK_COOLDOWN_MS - timeSinceLastCheck) / 1000);
      throw ApiError.custom(
        429,
        `Health check cooldown active. Please wait ${remainingSeconds} seconds before testing again.`,
        'HEALTH_CHECK_COOLDOWN'
      );
    }

    // Get config
    let config = await this.settingsRepository.getConfig(companyId);
    if (!config) {
      config = AiProviderConfig.defaultForCompany(companyId);
    } else {
      config = this.decryptConfig(config);
    }

    if (input.providerOverride || input.modelOverride) {
      config = AiProviderConfig.fromJSON({
        ...config.toPersistenceJSON(),
        provider: input.providerOverride || config.provider,
        model: input.modelOverride || config.model,
        updatedAt: config.updatedAt.toISOString(),
      });
    }

    const modelName = config.model || 'unknown';
    const modelProfile = await this.resolveModelProfile(config.provider, modelName);

    // Check if AI is enabled
    if (!config.isEnabled) {
      return {
        ready: false,
        networkOk: false,
        inferenceOk: false,
        provider: config.provider,
        model: modelName,
        reason: 'AI Assistant is not enabled for this company',
        modelProfile: this.toModelProfileResult(modelProfile),
        toolDiagnostics: this.buildSkippedToolDiagnostics('AI Assistant is disabled'),
        checks: [
          { id: 'network', status: 'skipped', ok: false, detail: 'AI Assistant is disabled' },
          { id: 'inference', status: 'skipped', ok: false, detail: 'AI Assistant is disabled' },
          { id: 'nativeToolCalling', status: 'skipped', ok: false, detail: 'AI Assistant is disabled' },
          { id: 'textPlan', status: 'skipped', ok: false, detail: 'AI Assistant is disabled' },
        ],
      };
    }

    const provider = ProviderFactory.getProvider(config, this.httpClient);
    const providerCapabilities = provider.getCapabilities();

    // Step 1: Network connectivity check
    let networkOk = false;
    let networkError: string | undefined;

    try {
      networkOk = await provider.isAvailable();
    } catch (error) {
      networkError = this.sanitizeError(error);
    }

    // Step 2: Inference check (safe prompt only)
    let inferenceOk = false;
    let inferenceError: string | undefined;

    try {
      const response = await provider.chat({
        messages: [
          { role: 'user', content: 'Reply with only: provider-ok' },
        ],
        maxTokens: 10,
        temperature: 0,
      });

      // The provider responded without error — inference works
      // We don't strictly require the response to contain "provider-ok"
      // because some models add extra text. The fact that it returned
      // a non-error response is sufficient.
      inferenceOk = true;
    } catch (error) {
      inferenceError = this.sanitizeError(error);
    }

    // Step 3: Native OpenAI-style tool calling probe.
    const nativeToolCalling = await this.runNativeToolCallingDiagnostic(
      provider,
      providerCapabilities.supportsToolCalling,
      modelProfile.supportsToolCalling,
      networkOk && inferenceOk
    );

    // Step 4: Guarded text-plan fallback probe. Run only when it matters:
    // native failed, the catalog is text-only, or the provider cannot expose tools.
    const shouldRunTextPlan =
      networkOk &&
      inferenceOk &&
      (!nativeToolCalling.ok || modelProfile.textOnlyMode || !providerCapabilities.supportsToolCalling);
    const textPlan = await this.runTextPlanDiagnostic(provider, shouldRunTextPlan);
    const nativeEnabledForRuntime =
      nativeToolCalling.ok &&
      modelProfile.supportsToolCalling &&
      !modelProfile.textOnlyMode;
    const recommendedMode = this.resolveRecommendedMode(inferenceOk, nativeEnabledForRuntime, textPlan.ok);
    const erpToolsReady = nativeEnabledForRuntime || textPlan.ok;

    // Determine overall ready status
    const ready = networkOk && inferenceOk;
    const diagnosticStatus = ready && erpToolsReady ? 'passed' : 'failed';

    // Build reason message (never includes API key or sensitive data)
    let reason: string | undefined;
    if (!networkOk && !inferenceOk) {
      reason = inferenceError || networkError || 'Provider is not responding';
    } else if (!networkOk) {
      reason = networkError || 'Network connectivity check failed';
    } else if (!inferenceOk) {
      reason = inferenceError || 'Inference check failed — the model could not generate a response';
    }

    // Record the health check timestamp for cooldown
    lastHealthCheck.set(cooldownKey, Date.now());

    if (this.modelProfileUseCase) {
      await this.modelProfileUseCase.recordDiagnostics({
        provider: config.provider,
        modelName,
        status: diagnosticStatus,
        mode: recommendedMode,
        companyId,
        detail: nativeToolCalling.ok
          ? nativeToolCalling.detail
          : textPlan.detail || nativeToolCalling.detail || reason,
      });
    }

    return {
      ready,
      networkOk,
      inferenceOk,
      provider: config.provider,
      model: config.model || provider.providerName,
      reason,
      modelProfile: this.toModelProfileResult(modelProfile),
      toolDiagnostics: {
        erpToolsReady,
        recommendedMode,
        nativeToolCalling,
        textPlan,
      },
      checks: [
        {
          id: 'network',
          status: networkOk ? 'passed' : 'failed',
          ok: networkOk,
          detail: networkOk ? 'Provider connectivity check passed' : networkError,
        },
        {
          id: 'inference',
          status: inferenceOk ? 'passed' : 'failed',
          ok: inferenceOk,
          detail: inferenceOk ? 'Model generated a response' : inferenceError,
        },
        {
          id: 'nativeToolCalling',
          status: nativeToolCalling.attempted
            ? (nativeToolCalling.ok ? 'passed' : 'failed')
            : 'skipped',
          ok: nativeToolCalling.ok,
          detail: nativeToolCalling.detail,
        },
        {
          id: 'textPlan',
          status: textPlan.attempted ? (textPlan.ok ? 'passed' : 'failed') : 'skipped',
          ok: textPlan.ok,
          detail: textPlan.detail,
        },
      ],
    };
  }

  /**
   * Reset the health check cooldown for a company (useful for testing).
   */
  static resetCooldown(companyId?: string): void {
    if (companyId) {
      lastHealthCheck.delete(companyId);
    } else {
      lastHealthCheck.clear();
    }
  }

  /**
   * Decrypt the apiKey in an AiProviderConfig after loading from storage.
   */
  private decryptConfig(config: AiProviderConfig): AiProviderConfig {
    if (!config.apiKey) {
      return config;
    }

    if (config.apiKey.startsWith('plain:')) {
      const plainKey = config.apiKey.substring(6);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: plainKey,
        updatedAt: config.updatedAt.toISOString(),
      });
    }

    try {
      const decrypted = this.encryptionService.decrypt(config.apiKey);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: decrypted,
        updatedAt: config.updatedAt.toISOString(),
      });
    } catch (error) {
      console.warn(
        `[AI Assistant] Failed to decrypt API key for company ${config.companyId}. ` +
        `Error: ${(error as Error).message}`
      );
      return config;
    }
  }

  private async runNativeToolCallingDiagnostic(
    provider: IAiProvider,
    supportedByProvider: boolean,
    expectedByCatalog: boolean,
    canCallProvider: boolean,
  ): Promise<NativeToolCallingDiagnostic> {
    if (!canCallProvider) {
      return {
        attempted: false,
        ok: false,
        supportedByProvider,
        expectedByCatalog,
        detail: 'Skipped because provider connectivity or inference failed',
      };
    }

    if (!supportedByProvider) {
      return {
        attempted: false,
        ok: false,
        supportedByProvider,
        expectedByCatalog,
        detail: 'Provider adapter does not expose OpenAI-style tool calling',
      };
    }

    try {
      const response = await provider.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are running a private compatibility diagnostic. Use the provided tool when asked. ' +
              'Do not include ERP data.',
          },
          {
            role: 'user',
            content:
              'Call the diagnostics_ping tool exactly once with this JSON argument: ' +
              '{"probe":"native-tool-call-ok"}. Do not answer with normal text.',
          },
        ],
        tools: [DIAGNOSTIC_TOOL],
        maxTokens: 64,
        temperature: 0,
      });

      const ok = response.toolCalls?.some(toolCall =>
        toolCall.name === DIAGNOSTIC_TOOL.name &&
        toolCall.arguments?.probe === 'native-tool-call-ok'
      ) ?? false;

      return {
        attempted: true,
        ok,
        supportedByProvider,
        expectedByCatalog,
        detail: ok
          ? 'Model returned a valid OpenAI-style tool_calls response'
          : 'Model answered without a valid OpenAI-style tool_calls response',
      };
    } catch (error) {
      return {
        attempted: true,
        ok: false,
        supportedByProvider,
        expectedByCatalog,
        detail: this.sanitizeError(error),
      };
    }
  }

  private async runTextPlanDiagnostic(
    provider: IAiProvider,
    shouldAttempt: boolean,
  ): Promise<TextPlanDiagnostic> {
    if (!shouldAttempt) {
      return {
        attempted: false,
        ok: false,
        detail: 'Skipped because native tool calling worked',
      };
    }

    try {
      const response = await provider.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are running a private compatibility diagnostic. Return only the requested JSON block. ' +
              'Do not include ERP data.',
          },
          {
            role: 'user',
            content:
              `Return exactly this block and no other text:\n` +
              `${TEXT_PLAN_START}\n` +
              `{"calls":[{"tool":"diagnostics_ping","arguments":{"probe":"text-plan-ok"},"reason":"diagnostic"}]}\n` +
              `${TEXT_PLAN_END}`,
          },
        ],
        maxTokens: 160,
        temperature: 0,
      });

      const ok = this.containsValidTextPlan(response.content);
      return {
        attempted: true,
        ok,
        detail: ok
          ? 'Model returned a valid guarded ERP_TOOL_PLAN block'
          : 'Model did not return a valid guarded ERP_TOOL_PLAN block',
      };
    } catch (error) {
      return {
        attempted: true,
        ok: false,
        detail: this.sanitizeError(error),
      };
    }
  }

  private containsValidTextPlan(content: string | null): boolean {
    if (!content) {
      return false;
    }

    const startIndex = content.indexOf(TEXT_PLAN_START);
    const endIndex = content.indexOf(TEXT_PLAN_END);
    if (startIndex < 0 || endIndex <= startIndex) {
      return false;
    }

    const jsonText = content
      .slice(startIndex + TEXT_PLAN_START.length, endIndex)
      .trim();

    try {
      const parsed = JSON.parse(jsonText) as any;
      const calls = Array.isArray(parsed?.calls) ? parsed.calls : [];
      return calls.some((call: any) =>
        call?.tool === DIAGNOSTIC_TOOL.name &&
        call?.arguments?.probe === 'text-plan-ok'
      );
    } catch {
      return false;
    }
  }

  private resolveRecommendedMode(
    inferenceOk: boolean,
    nativeToolCallingOk: boolean,
    textPlanOk: boolean,
  ): ProviderRecommendedToolMode {
    if (nativeToolCallingOk) {
      return 'native-tool-calling';
    }
    if (textPlanOk) {
      return 'text-plan';
    }
    if (inferenceOk) {
      return 'text-only';
    }
    return 'unavailable';
  }

  private toModelProfileResult(profile: AiModelProfile): ProviderModelProfileResult {
    return {
      provider: profile.provider,
      modelName: profile.modelName,
      status: profile.status,
      supportsToolCalling: profile.supportsToolCalling,
      supportsStructuredJson: profile.supportsStructuredJson,
      textOnlyMode: profile.textOnlyMode,
      warningLevel: profile.warningLevel,
      warningMessage: profile.warningMessage,
      recommendedUseCases: profile.recommendedUseCases,
    };
  }

  private async resolveModelProfile(provider: string, modelName: string): Promise<AiModelProfile> {
    if (this.modelProfileUseCase) {
      return this.modelProfileUseCase.resolveRuntimeProfile(provider, modelName);
    }
    return AiModelCapabilityCatalog.getProfile(provider, modelName);
  }

  private buildSkippedToolDiagnostics(reason: string): ProviderToolDiagnostics {
    return {
      erpToolsReady: false,
      recommendedMode: 'unavailable',
      nativeToolCalling: {
        attempted: false,
        ok: false,
        supportedByProvider: false,
        expectedByCatalog: false,
        detail: reason,
      },
      textPlan: {
        attempted: false,
        ok: false,
        detail: reason,
      },
    };
  }

  /**
   * Sanitize error messages to prevent API key or endpoint leakage.
   * Returns a generic, user-safe error description.
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof ProviderError) {
      const pe = error as ProviderError;
      // Map to normalized status descriptions — never include raw messages
      const statusCode = (pe as any).statusCode;
      if (statusCode === 401) return 'Authentication failed — check your API key';
      if (statusCode === 429) return 'Rate limit exceeded — try again later';
      if (statusCode === 503) return 'Provider is temporarily unavailable';
      if (statusCode === 502) return 'Provider returned an error response';
      return 'Provider error — please check your configuration';
    }

    if (error instanceof Error) {
      // Don't include raw error messages — they may contain URLs, keys, etc.
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return 'Request timed out — check your network connection';
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        return 'Could not connect to the provider — check the endpoint URL';
      }
      return 'An unexpected error occurred while checking the provider';
    }

    return 'An unknown error occurred';
  }
}
