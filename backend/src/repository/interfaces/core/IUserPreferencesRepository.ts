import { UserPreferences } from '../../../domain/core/entities/UserPreferences';

export interface IUserPreferencesRepository {
  /**
   * Get preferences for a user. Returns null if not set.
   */
  getByUserId(userId: string): Promise<UserPreferences | null>;

  /**
   * Create or update preferences for a user.
   */
  upsert(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences>;
}

