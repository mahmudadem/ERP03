import { Firestore } from 'firebase-admin/firestore';
import { IAiToolCatalogRepository } from '../../../../repository/interfaces/ai-assistant/IAiToolCatalogRepository';
import { AiToolDefinition } from '../../../../domain/ai-assistant/entities/AiToolDefinition';

/**
 * FirestoreAiToolCatalogRepository
 *
 * Stores tool definitions under:
 *   system_metadata/ai_tools/{toolId}
 *
 * Tool definitions are platform-level — they are NOT company-scoped.
 * Super Admin manages which tools are available system-wide.
 */
export class FirestoreAiToolCatalogRepository implements IAiToolCatalogRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('ai_tools').collection('catalog');
  }

  async getById(toolId: string): Promise<AiToolDefinition | null> {
    const doc = await this.getCollection().doc(toolId).get();
    if (!doc.exists) return null;
    return AiToolDefinition.fromJSON(doc.data()!);
  }

  async list(): Promise<AiToolDefinition[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => AiToolDefinition.fromJSON(doc.data()!));
  }

  async listByModule(moduleId: string): Promise<AiToolDefinition[]> {
    const snapshot = await this.getCollection().where('moduleId', '==', moduleId).get();
    return snapshot.docs.map(doc => AiToolDefinition.fromJSON(doc.data()!));
  }

  async listByCategory(category: string): Promise<AiToolDefinition[]> {
    const snapshot = await this.getCollection().where('category', '==', category).get();
    return snapshot.docs.map(doc => AiToolDefinition.fromJSON(doc.data()!));
  }

  async listByStatus(status: string): Promise<AiToolDefinition[]> {
    const snapshot = await this.getCollection().where('status', '==', status).get();
    return snapshot.docs.map(doc => AiToolDefinition.fromJSON(doc.data()!));
  }

  async save(definition: AiToolDefinition): Promise<void> {
    const data = definition.toJSON();
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        clean[key] = value;
      }
    }
    await this.getCollection().doc(definition.id).set(clean);
  }

  async delete(toolId: string): Promise<void> {
    await this.getCollection().doc(toolId).delete();
  }
}