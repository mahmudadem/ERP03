import { Firestore } from 'firebase-admin/firestore';
import { AiPlatformRuntimeProfile } from '../../../../domain/ai-assistant/entities/AiPlatformRuntimeProfile';
import {
  IAiPlatformRuntimeProfileRepository,
  ReserveSlotResult,
} from '../../../../repository/interfaces/ai-assistant/IAiPlatformRuntimeProfileRepository';

const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
};

export class FirestoreAiPlatformRuntimeProfileRepository implements IAiPlatformRuntimeProfileRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db
      .collection('system_metadata')
      .doc('ai_runtime_profiles')
      .collection('items');
  }

  async getById(id: string): Promise<AiPlatformRuntimeProfile | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return AiPlatformRuntimeProfile.fromJSON(doc.data()!);
  }

  async getByProviderAndModel(providerId: string, modelProfileId: string): Promise<AiPlatformRuntimeProfile | null> {
    return this.getById(AiPlatformRuntimeProfile.makeId(providerId, modelProfileId));
  }

  async list(): Promise<AiPlatformRuntimeProfile[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => AiPlatformRuntimeProfile.fromJSON(doc.data()));
  }

  async save(profile: AiPlatformRuntimeProfile): Promise<void> {
    await this.getCollection().doc(profile.id).set(stripUndefined(profile.toPersistenceJSON()));
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }

  async tryReserveSlot(providerId: string, modelProfileId: string, now: Date = new Date()): Promise<ReserveSlotResult> {
    const id = AiPlatformRuntimeProfile.makeId(providerId, modelProfileId);
    const ref = this.getCollection().doc(id);

    return this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { allowed: false, reason: 'No platform runtime profile configured for this provider/model.', profile: null };
      }

      const profile = AiPlatformRuntimeProfile.fromJSON(snap.data()!);
      const capacity = profile.canConsume(now);
      if (!capacity.allowed) {
        return { allowed: false, reason: capacity.reason, profile };
      }

      const reserved = profile.recordSuccessfulRequest(now);
      tx.set(ref, stripUndefined(reserved.toPersistenceJSON()));
      return { allowed: true, profile: reserved };
    });
  }
}
