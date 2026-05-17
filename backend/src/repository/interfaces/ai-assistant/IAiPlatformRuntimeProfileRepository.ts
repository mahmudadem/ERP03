import { AiPlatformRuntimeProfile } from '../../../domain/ai-assistant/entities/AiPlatformRuntimeProfile';

export interface ReserveSlotResult {
  allowed: boolean;
  reason?: string;
  profile: AiPlatformRuntimeProfile | null;
}

export interface IAiPlatformRuntimeProfileRepository {
  getById(id: string): Promise<AiPlatformRuntimeProfile | null>;
  getByProviderAndModel(providerId: string, modelProfileId: string): Promise<AiPlatformRuntimeProfile | null>;
  list(): Promise<AiPlatformRuntimeProfile[]>;
  save(profile: AiPlatformRuntimeProfile): Promise<void>;
  delete(id: string): Promise<void>;
  /**
   * Atomically check the cap and increment usage counters in a single transaction.
   * Pre-flight reservation: prevents TOCTOU under concurrent requests. Failed downstream
   * calls still consume the cap — a conservative trade-off that bounds platform LLM spend.
   * Returns { allowed: false } if profile missing, paused/disabled, no credential, or cap hit.
   */
  tryReserveSlot(providerId: string, modelProfileId: string, now?: Date): Promise<ReserveSlotResult>;
}
