/**
 * settingsHelpers.ts
 *
 * Shared types, constants, and helper functions for AI Assistant settings.
 * Hoisted outside components for rerender-efficiency (static data pattern).
 */

import type { TFunction } from 'i18next';
import { CheckCircle2, CircleMinus, XCircle } from 'lucide-react';
import type { TenantAiProviderOption } from '../../../api/aiAssistantApi';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AiProviderType = 'mock' | 'openai_compatible' | 'ollama';
export type ConversationContextMode = 'minimal' | 'balanced' | 'deep';

export interface ProviderPreset {
  id: string;
  providerType: AiProviderType;
  endpoint: string;
  defaultModel: string;
  requiresApiKey: boolean;
}

// ── Static data ────────────────────────────────────────────────────────────────

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'mock',        providerType: 'mock',               endpoint: '',                                    defaultModel: 'mock-assistant',               requiresApiKey: false },
  { id: 'openai',      providerType: 'openai_compatible',  endpoint: 'https://api.openai.com/v1',          defaultModel: 'gpt-4o',                       requiresApiKey: true  },
  { id: 'openrouter',  providerType: 'openai_compatible',  endpoint: 'https://openrouter.ai/api/v1',       defaultModel: 'openai/gpt-oss-120b:free',      requiresApiKey: true  },
  { id: 'groq',        providerType: 'openai_compatible',  endpoint: 'https://api.groq.com/openai/v1',     defaultModel: 'llama-3.3-70b-versatile',        requiresApiKey: true  },
  { id: 'ollama',      providerType: 'ollama',             endpoint: 'http://localhost:11434/v1',          defaultModel: 'llama3',                        requiresApiKey: false },
  { id: 'custom',      providerType: 'openai_compatible',  endpoint: '',                                    defaultModel: '',                              requiresApiKey: true  },
];

export const PRESET_LABEL_FALLBACKS: Record<string, string> = {
  mock: 'Mock (Dev Only)',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  ollama: 'Ollama (Local)',
  custom: 'Custom',
};

export const PRESET_DESC_FALLBACKS: Record<string, string> = {
  mock: 'Simulated responses for development testing only. Not a real AI provider.',
  openai: 'GPT-4o and other OpenAI models. Requires an API key.',
  openrouter: 'Access 200+ models. Requires an OpenRouter API key.',
  groq: 'Ultra-fast inference. Requires a Groq API key.',
  ollama: 'Run models locally. No cloud API key needed.',
  custom: 'Use any OpenAI-compatible endpoint manually.',
};

export const DIAGNOSTIC_CHECK_FALLBACKS: Record<string, string> = {
  network: 'Provider connection',
  inference: 'Model response',
  nativeToolCalling: 'Native tool calling',
  textPlan: 'Guarded text-plan fallback',
};

export const DIAGNOSTIC_MODE_FALLBACKS: Record<string, string> = {
  'native-tool-calling': 'Native tool calling',
  'text-plan': 'Guarded text-plan',
  'text-only': 'Text only',
  unavailable: 'Unavailable',
};

// ── Helper functions ────────────────────────────────────────────────────────────

export function resolvePresetId(provider: string, apiEndpoint: string): string {
  if (provider === 'mock') return 'mock';
  if (provider === 'ollama') return 'ollama';
  const matched = PROVIDER_PRESETS.find(
    (p) => p.providerType === 'openai_compatible' && p.id !== 'custom' && p.endpoint === apiEndpoint
  );
  return matched ? matched.id : 'custom';
}

export function getDiagnosticStatusClasses(status: string): string {
  if (status === 'passed') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'failed') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export function getDiagnosticStatusIcon(status: string) {
  if (status === 'passed') return CheckCircle2;
  if (status === 'failed') return XCircle;
  return CircleMinus;
}

/**
 * Map a provider change to the correct provider/model/endpoint state.
 * Returns partial state updates or null for values that should remain unchanged.
 */
export function resolveProviderChange(
  newProviderId: string,
  availableProviders: TenantAiProviderOption[],
): {
  selectedProviderId: string;
  presetId: string;
  provider: AiProviderType;
  apiEndpoint: string;
  model: string;
} | null {
  if (newProviderId === '__mock__' || newProviderId === 'mock') {
    return {
      selectedProviderId: '__mock__',
      presetId: 'mock',
      provider: 'mock',
      apiEndpoint: '',
      model: 'mock-assistant',
    };
  }

  if (newProviderId === '__custom__' || newProviderId === 'custom') {
    return {
      selectedProviderId: '__custom__',
      presetId: 'custom',
      provider: 'openai_compatible',
      apiEndpoint: '',
      model: '',
    };
  }

  // Legacy preset IDs
  const legacyPreset = PROVIDER_PRESETS.find((p) => p.id === newProviderId);
  if (legacyPreset && !availableProviders.some((p) => p.id === newProviderId)) {
    return {
      selectedProviderId: '',
      presetId: newProviderId,
      provider: legacyPreset.providerType,
      apiEndpoint: legacyPreset.endpoint,
      model: legacyPreset.defaultModel,
    };
  }

  // Dynamic provider from API
  const found = availableProviders.find((p) => p.id === newProviderId);
  if (found) {
    let legacyType: AiProviderType = 'openai_compatible';
    if (found.type === 'ollama') legacyType = 'ollama';
    return {
      selectedProviderId: newProviderId,
      presetId: '',
      provider: legacyType,
      apiEndpoint: found.defaultBaseUrl || '',
      model: '',
    };
  }

  // Fallback to custom
  return {
    selectedProviderId: '__custom__',
    presetId: 'custom',
    provider: 'openai_compatible',
    apiEndpoint: '',
    model: '',
  };
}