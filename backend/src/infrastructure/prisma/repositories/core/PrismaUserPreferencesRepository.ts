import { PrismaClient } from '@prisma/client';
import { IUserPreferencesRepository } from '../../../../repository/interfaces/core/IUserPreferencesRepository';
import { UserPreferences, UiMode, Theme, SidebarMode } from '../../../../domain/core/entities/UserPreferences';

export class PrismaUserPreferencesRepository implements IUserPreferencesRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): UserPreferences {
    return new UserPreferences(
      data.userId,
      data.language || 'en',
      (data.uiMode as UiMode) || 'windows',
      (data.theme as Theme) || 'light',
      (data.sidebarMode as SidebarMode) || 'classic',
      data.sidebarPinned ?? true,
      (data.disabledNotificationCategories as string[]) || [],
      (data.notificationCategoryOverrides as Record<string, boolean>) || {},
      data.createdAt,
      data.updatedAt
    );
  }

  async getByUserId(userId: string): Promise<UserPreferences | null> {
    const data = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async upsert(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const updateData: any = {};
    if (prefs.language !== undefined) updateData.language = prefs.language;
    if (prefs.uiMode !== undefined) updateData.uiMode = prefs.uiMode;
    if (prefs.theme !== undefined) updateData.theme = prefs.theme;
    if (prefs.sidebarMode !== undefined) updateData.sidebarMode = prefs.sidebarMode;
    if (prefs.sidebarPinned !== undefined) updateData.sidebarPinned = prefs.sidebarPinned;
    if (prefs.disabledNotificationCategories !== undefined) updateData.disabledNotificationCategories = prefs.disabledNotificationCategories as any;
    if (prefs.notificationCategoryOverrides !== undefined) updateData.notificationCategoryOverrides = prefs.notificationCategoryOverrides as any;

    const data = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData,
      },
      update: updateData,
    });
    return this.toDomain(data);
  }
}
