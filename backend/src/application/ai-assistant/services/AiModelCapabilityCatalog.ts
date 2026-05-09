/**
 * AiModelCapabilityCatalog - Static model capability metadata
 *
 * Provides known model profiles with their tool-calling capabilities,
 * warning levels, and recommended use cases. Unknown/custom models
 * default to safe, conservative settings with textOnlyMode=true.
 *
 * DESIGN PRINCIPLES:
 * - Never hardcode secrets or API keys — only metadata
 * - Unknown models are treated conservatively (text-only, warnings)
 * - The catalog is static and deterministic — no AI involved
 * - Provider names are lowercase and normalized
 * - This is application layer — no infrastructure dependencies
 */

import { AiModelProfile as EditableAiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';

export type ModelStatus =
  | 'recommended'
  | 'tested'
  | 'experimental'
  | 'custom'
  | 'blocked'
  | 'deprecated'
  | 'text_only'
  | 'uncertified'
  | 'legacy_unverified';
export type ModelWarningLevel = 'none' | 'info' | 'warning' | 'danger';

export interface AiModelProfile {
  /** Provider identifier, e.g. 'mock', 'openai_compatible', 'ollama' */
  provider: string;
  /** Model name as used in API calls, e.g. 'gpt-4o', 'llama3' */
  modelName: string;
  /** Trust/status level: recommended > tested > experimental > custom */
  status: ModelStatus;
  /** Whether this model supports function/tool calling */
  supportsToolCalling: boolean;
  /** Whether this model supports structured JSON output */
  supportsStructuredJson: boolean;
  /** Maximum context window in tokens (approximate) */
  maxContextTokens: number;
  /** Recommended use cases for this model */
  recommendedUseCases: string[];
  /** Warning level for this model */
  warningLevel: ModelWarningLevel;
  /** If true, only text mode is used — no tool calls exposed */
  textOnlyMode: boolean;
  /** Human-readable warning message displayed to admin/user */
  warningMessage: string;
}

/**
 * Known model profiles.
 * Keys are `provider:modelName` (lowercase).
 */
const KNOWN_PROFILES: Record<string, Partial<AiModelProfile>> = {
  // ─── Mock Provider ────────────────────────────────────────────────────
  'mock:mock': {
    status: 'recommended',
    supportsToolCalling: false,
    supportsStructuredJson: false,
    maxContextTokens: 4096,
    recommendedUseCases: ['development', 'testing'],
    warningLevel: 'none',
    textOnlyMode: true,
    warningMessage: '',
  },

  // ─── OpenAI-Compatible Recommended ─────────────────────────────────────
  'openai_compatible:gpt-4o': {
    status: 'recommended',
    supportsToolCalling: true,
    supportsStructuredJson: true,
    maxContextTokens: 128000,
    recommendedUseCases: ['general', 'accounting', 'reporting', 'multi-step-tools'],
    warningLevel: 'none',
    textOnlyMode: false,
    warningMessage: '',
  },
  'openai_compatible:gpt-4o-mini': {
    status: 'recommended',
    supportsToolCalling: true,
    supportsStructuredJson: true,
    maxContextTokens: 128000,
    recommendedUseCases: ['general', 'fast-response'],
    warningLevel: 'none',
    textOnlyMode: false,
    warningMessage: '',
  },
  'openai_compatible:gpt-4-turbo': {
    status: 'recommended',
    supportsToolCalling: true,
    supportsStructuredJson: true,
    maxContextTokens: 128000,
    recommendedUseCases: ['general', 'accounting', 'complex-reasoning'],
    warningLevel: 'none',
    textOnlyMode: false,
    warningMessage: '',
  },
  'openai_compatible:gpt-4': {
    status: 'tested',
    supportsToolCalling: true,
    supportsStructuredJson: true,
    maxContextTokens: 8192,
    recommendedUseCases: ['general', 'accounting'],
    warningLevel: 'info',
    textOnlyMode: false,
    warningMessage: 'GPT-4 has a smaller context window compared to GPT-4o. Consider upgrading to GPT-4o for better performance.',
  },
  'openai_compatible:gpt-3.5-turbo': {
    status: 'tested',
    supportsToolCalling: true,
    supportsStructuredJson: false,
    maxContextTokens: 16385,
    recommendedUseCases: ['general', 'fast-response'],
    warningLevel: 'info',
    textOnlyMode: false,
    warningMessage: 'GPT-3.5 Turbo has limited reasoning compared to GPT-4o. Tool call accuracy may be lower.',
  },

  // ─── OpenRouter Specific ──────────────────────────────────────────────
  'openai_compatible:openrouter-auto': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: false,
    maxContextTokens: 32768,
    recommendedUseCases: ['general'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'OpenRouter auto-routing does not guarantee tool calling support. Using text-only mode.',
  },
  'openai_compatible:google/gemma-4-31b-it:free': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: true,
    maxContextTokens: 32768,
    recommendedUseCases: ['general', 'reporting-test', 'text-plan-tools'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'Gemma free model is registered for testing. Native tool calling is not verified; using guarded ERP_TOOL_PLAN text-plan mode.',
  },
  'openai_compatible:openai/gpt-oss-20b:free': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: true,
    maxContextTokens: 32768,
    recommendedUseCases: ['general', 'reporting-test', 'text-plan-tools'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'GPT-OSS free model is registered for testing. Native tool calling is not verified; using guarded ERP_TOOL_PLAN text-plan mode.',
  },
  'openai_compatible:z-ai/glm-4.5-air:free': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: true,
    maxContextTokens: 32768,
    recommendedUseCases: ['general', 'analysis-test', 'text-plan-tools'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'GLM free model is registered for testing. Native tool calling is not verified; using guarded ERP_TOOL_PLAN text-plan mode.',
  },
  'openai_compatible:tencent/hy3-preview:free': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: true,
    maxContextTokens: 32768,
    recommendedUseCases: ['finance-test', 'accounting-test', 'reporting-test', 'text-plan-tools'],
    warningLevel: 'info',
    textOnlyMode: true,
    warningMessage: 'Tencent HY3 preview free model is registered for finance/reporting testing. Native tool calling is not verified; using guarded ERP_TOOL_PLAN text-plan mode.',
  },

  // ─── Ollama Models ────────────────────────────────────────────────────
  'ollama:llama3': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: false,
    maxContextTokens: 8192,
    recommendedUseCases: ['general', 'testing'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'Llama 3 via Ollama does not reliably support tool calling. Using text-only mode.',
  },
  'ollama:llama3.1': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: false,
    maxContextTokens: 131072,
    recommendedUseCases: ['general', 'long-context'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'Llama 3.1 via Ollama has experimental tool calling. Using text-only mode for reliability.',
  },
  'ollama:mixtral': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: false,
    maxContextTokens: 32768,
    recommendedUseCases: ['general'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'Mixtral via Ollama does not reliably support tool calling. Using text-only mode.',
  },
  'ollama:qwen2': {
    status: 'experimental',
    supportsToolCalling: false,
    supportsStructuredJson: false,
    maxContextTokens: 32768,
    recommendedUseCases: ['general'],
    warningLevel: 'warning',
    textOnlyMode: true,
    warningMessage: 'Qwen2 via Ollama has experimental tool calling. Using text-only mode.',
  },
};

/**
 * Pattern-based fallback heuristics for models not in KNOWN_PROFILES.
 * These provide partial matches for common model name patterns.
 */
const PATTERN_RULES: Array<{ pattern: RegExp; partial: Partial<AiModelProfile> }> = [
  { pattern: /^gpt-4/i, partial: { status: 'tested', supportsToolCalling: true, supportsStructuredJson: true, maxContextTokens: 128000, textOnlyMode: false } },
  { pattern: /^gpt-3\.5/i, partial: { status: 'tested', supportsToolCalling: true, supportsStructuredJson: false, maxContextTokens: 16385, textOnlyMode: false } },
  { pattern: /^claude/i, partial: { status: 'tested', supportsToolCalling: true, supportsStructuredJson: true, maxContextTokens: 200000, textOnlyMode: false } },
  { pattern: /^gemini/i, partial: { status: 'experimental', supportsToolCalling: true, supportsStructuredJson: true, maxContextTokens: 32768, textOnlyMode: false } },
  { pattern: /^llama/i, partial: { status: 'experimental', supportsToolCalling: false, supportsStructuredJson: false, maxContextTokens: 8192, textOnlyMode: true } },
  { pattern: /^mistral/i, partial: { status: 'tested', supportsToolCalling: true, supportsStructuredJson: true, maxContextTokens: 32768, textOnlyMode: false } },
  { pattern: /^mixtral/i, partial: { status: 'experimental', supportsToolCalling: false, supportsStructuredJson: false, maxContextTokens: 32768, textOnlyMode: true } },
  { pattern: /^qwen/i, partial: { status: 'experimental', supportsToolCalling: false, supportsStructuredJson: false, maxContextTokens: 32768, textOnlyMode: true } },
  { pattern: /^deepseek/i, partial: { status: 'experimental', supportsToolCalling: false, supportsStructuredJson: false, maxContextTokens: 32768, textOnlyMode: true } },
];

export class AiModelCapabilityCatalog {
  /**
   * Get the model profile for a given provider and model combination.
   *
   * Resolution order:
   * 1. Exact match in KNOWN_PROFILES (provider:model)
   * 2. Pattern-based fallback for known model families
   * 3. Custom/unknown default with textOnlyMode=true and warning
   *
   * Provider is normalized to lowercase. Model name is also lowercased
   * for matching but the original casing is preserved in the result.
   */
  static getProfile(provider: string, modelName: string | null | undefined): AiModelProfile {
    const normalizedProvider = (provider || '').toLowerCase().trim();
    const normalizedModel = (modelName || '').toLowerCase().trim();
    const modelCandidates = AiModelCapabilityCatalog.getModelNameCandidates(normalizedModel);

    // 1. Exact match
    for (const candidate of modelCandidates) {
      const key = `${normalizedProvider}:${candidate}`;
      const known = KNOWN_PROFILES[key];
      if (known) {
        return {
          provider: normalizedProvider,
          modelName: modelName || '',
          status: known.status ?? 'custom',
          supportsToolCalling: known.supportsToolCalling ?? false,
          supportsStructuredJson: known.supportsStructuredJson ?? false,
          maxContextTokens: known.maxContextTokens ?? 4096,
          recommendedUseCases: known.recommendedUseCases ?? ['general'],
          warningLevel: known.warningLevel ?? 'info',
          textOnlyMode: known.textOnlyMode ?? true,
          warningMessage: known.warningMessage ?? '',
        };
      }
    }

    // 2. Pattern fallback
    for (const rule of PATTERN_RULES) {
      if (modelCandidates.some(candidate => rule.pattern.test(candidate))) {
        const base = rule.partial;
        const isExperimental = base.status === 'experimental';
        return {
          provider: normalizedProvider,
          modelName: modelName || '',
          status: base.status ?? 'tested',
          supportsToolCalling: base.supportsToolCalling ?? false,
          supportsStructuredJson: base.supportsStructuredJson ?? false,
          maxContextTokens: base.maxContextTokens ?? 4096,
          recommendedUseCases: ['general'],
          warningLevel: isExperimental ? 'warning' : 'info',
          textOnlyMode: base.textOnlyMode ?? false,
          warningMessage: isExperimental
            ? `Model '${modelName}' is experimental. Tool calling may not work reliably.`
            : `Model '${modelName}' is not in the tested list but may support tool calling.`,
        };
      }
    }

    // 3. Custom/unknown — conservative defaults
    // Special: Ollama provider without a known model — default to text-only
    const isOllama = normalizedProvider === 'ollama';
    return {
      provider: normalizedProvider,
      modelName: modelName || '',
      status: 'custom',
      supportsToolCalling: false,
      supportsStructuredJson: false,
      maxContextTokens: 4096,
      recommendedUseCases: ['general'],
      warningLevel: isOllama ? 'warning' : 'danger',
      textOnlyMode: true,
      warningMessage: isOllama
        ? `Ollama model '${modelName || '(unknown)'}' is not in the tested list. Tool calling is disabled. Using text-only mode.`
        : `Model '${modelName || '(unknown)'}' on provider '${normalizedProvider}' is unknown. Tool calling is disabled for safety. Using text-only mode.`,
    };
  }

  /**
   * Check if a model profile supports tool calling and should have tools exposed.
   */
  static supportsToolCalling(provider: string, modelName: string | null | undefined): boolean {
    const profile = AiModelCapabilityCatalog.getProfile(provider, modelName);
    return profile.supportsToolCalling && !profile.textOnlyMode;
  }

  /**
   * Build model-name aliases used for capability lookup.
   *
   * Some OpenAI-compatible routers store model IDs with a provider prefix such
   * as `openai/gpt-4o-mini`. The runtime capability catalog is keyed by the
   * actual model family (`gpt-4o-mini`), so we check both forms before falling
   * back to conservative custom-model behavior.
   */
  private static getModelNameCandidates(normalizedModel: string): string[] {
    if (!normalizedModel) return [''];

    const candidates = [normalizedModel];
    const slashParts = normalizedModel.split('/').map(part => part.trim()).filter(Boolean);
    if (slashParts.length > 1) {
      candidates.push(slashParts[slashParts.length - 1]);
    }

    return Array.from(new Set(candidates));
  }

  /**
   * Get all known model profiles.
   */
  static getAllKnownProfiles(): AiModelProfile[] {
    return Object.entries(KNOWN_PROFILES).map(([key, partial]) => ({
      provider: key.split(':')[0],
      modelName: key.split(':').slice(1).join(':'),
      status: partial.status ?? 'custom',
      supportsToolCalling: partial.supportsToolCalling ?? false,
      supportsStructuredJson: partial.supportsStructuredJson ?? false,
      maxContextTokens: partial.maxContextTokens ?? 4096,
      recommendedUseCases: partial.recommendedUseCases ?? ['general'],
      warningLevel: partial.warningLevel ?? 'info',
      textOnlyMode: partial.textOnlyMode ?? true,
      warningMessage: partial.warningMessage ?? '',
    }));
  }

  static getAllKnownProfilesAsEntities(): EditableAiModelProfile[] {
    return AiModelCapabilityCatalog.getAllKnownProfiles().map(profile => new EditableAiModelProfile(
      EditableAiModelProfile.makeId(profile.provider, profile.modelName),
      profile.provider,
      profile.modelName,
      profile.status,
      profile.supportsToolCalling,
      profile.supportsStructuredJson,
      profile.maxContextTokens,
      profile.recommendedUseCases,
      profile.recommendedUseCases,
      profile.warningLevel,
      profile.textOnlyMode,
      profile.warningMessage,
      'never-tested',
    ));
  }
}
