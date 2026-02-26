import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IUserPreferencesRepository } from '../../../../repository/interfaces/core/IUserPreferencesRepository';
import { UserPreferences } from '../../../../domain/core/entities/UserPreferences';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreUserPreferencesRepository
  extends BaseFirestoreRepository<UserPreferences>
  implements IUserPreferencesRepository {
  protected collectionName = 'userPreferences';

  protected toDomain(data: any): UserPreferences {
    return new UserPreferences(
      data.userId,
      data.language || 'en',
      data.uiMode || 'windows',
      data.theme || 'light',
      data.sidebarMode || 'classic',
      data.sidebarPinned !== undefined ? data.sidebarPinned : true,
      data.disabledNotificationCategories || [],
      data.notificationCategoryOverrides || {},
      data.createdAt ? data.createdAt.toDate?.() || data.createdAt : new Date(),
      data.updatedAt ? data.updatedAt.toDate?.() || data.updatedAt : new Date()
    );
  }

  protected toPersistence(entity: UserPreferences): any {
    return {
      userId: entity.userId,
      language: entity.language,
      uiMode: entity.uiMode,
      theme: entity.theme,
      sidebarMode: entity.sidebarMode,
      sidebarPinned: entity.sidebarPinned,
      disabledNotificationCategories: entity.disabledNotificationCategories,
      notificationCategoryOverrides: entity.notificationCategoryOverrides,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  async getByUserId(userId: string): Promise<UserPreferences | null> {
    const doc = await this.db.collection(this.collectionName).doc(userId).get();
    if (!doc.exists) return null;
    return this.toDomain({ userId, ...doc.data() });
  }

  async upsert(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const now = new Date();
      const payload: Record<string, any> = {
        updatedAt: now,
        userId,
      };

      // Firestore rejects undefined values unless ignoreUndefinedProperties is enabled.
      // Keep only explicitly provided preference keys.
      const allowedKeys: Array<keyof UserPreferences> = [
        'language',
        'uiMode',
        'theme',
        'sidebarMode',
        'sidebarPinned',
        'disabledNotificationCategories',
        'notificationCategoryOverrides',
        'createdAt',
      ];

      for (const key of allowedKeys) {
        const value = (prefs as any)?.[key];
        if (value !== undefined) {
          payload[key] = value;
        }
      }

      if (!payload.createdAt) {
        payload.createdAt = now;
      }

      await this.db.collection(this.collectionName).doc(userId).set(payload, { merge: true });
      const saved = await this.getByUserId(userId);
      if (!saved) throw new InfrastructureError('Failed to load saved preferences');
      return saved;
    } catch (error) {
      throw new InfrastructureError('Error saving user preferences', error);
    }
  }
}
