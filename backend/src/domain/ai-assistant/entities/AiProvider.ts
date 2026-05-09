export type AiProviderRegistryType =
  | 'openai'
  | 'openai_compatible'
  | 'google_gemini'
  | 'anthropic'
  | 'ollama'
  | 'custom';

export type AiProviderAuthType = 'api_key' | 'bearer' | 'none' | 'custom';

export interface AiProviderProps {
  id: string;
  name: string;
  type: AiProviderRegistryType;
  defaultBaseUrl?: string;
  authType: AiProviderAuthType;
  enabled: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  supportsModelSync: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AiProvider implements AiProviderProps {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: AiProviderRegistryType,
    public readonly defaultBaseUrl: string | undefined,
    public readonly authType: AiProviderAuthType,
    public readonly enabled: boolean,
    public readonly supportsTools: boolean,
    public readonly supportsJsonMode: boolean,
    public readonly supportsModelSync: boolean,
    public readonly notes: string | undefined = undefined,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {
    if (!id.trim()) throw new Error('AI provider id is required');
    if (!name.trim()) throw new Error('AI provider name is required');
  }

  static makeId(type: AiProviderRegistryType, name: string): string {
    const safeName = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, '-'));
    return `${type}:${safeName}`;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      defaultBaseUrl: this.defaultBaseUrl || null,
      authType: this.authType,
      enabled: this.enabled,
      supportsTools: this.supportsTools,
      supportsJsonMode: this.supportsJsonMode,
      supportsModelSync: this.supportsModelSync,
      notes: this.notes || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiProvider {
    return new AiProvider(
      data.id || AiProvider.makeId(data.type || 'custom', data.name || 'custom'),
      data.name || '',
      data.type || 'custom',
      data.defaultBaseUrl || undefined,
      data.authType || 'api_key',
      data.enabled !== false,
      data.supportsTools === true,
      data.supportsJsonMode === true,
      data.supportsModelSync === true,
      data.notes || undefined,
      data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
      data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
    );
  }
}
