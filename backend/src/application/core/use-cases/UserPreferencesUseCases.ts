import { IUserPreferencesRepository } from '../../../repository/interfaces/core/IUserPreferencesRepository';
import { UserPreferences } from '../../../domain/core/entities/UserPreferences';

export class GetUserPreferencesUseCase {
  constructor(private readonly repo: IUserPreferencesRepository) {}

  async execute(userId: string): Promise<UserPreferences | null> {
    return this.repo.getByUserId(userId);
  }
}

export class UpsertUserPreferencesUseCase {
  constructor(private readonly repo: IUserPreferencesRepository) {}

  async execute(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    return this.repo.upsert(userId, prefs);
  }
}

