import { Prisma, PrismaClient } from '@prisma/client';
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
      (data.appearanceSettings as Record<string, any>) || {},
      (data.disabledNotificationCategories as string[]) || [],
      (data.notificationCategoryOverrides as Record<string, boolean>) || {},
      data.createdAt,
      data.updatedAt,
      (data.appearanceSettings)?.layoutMode || 'legacy',
      (data.posShortcuts as Record<string, string>) || {}
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
    const existing = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    const existingAppearance = ((existing?.appearanceSettings as Record<string, unknown>) || {});

    // Create-input shape (minus the key) is assignable to both the `create`
    // and `update` sides of the upsert, keeping this fully schema-checked.
    const updateData: Omit<Prisma.UserPreferencesUncheckedCreateInput, 'userId'> = {};
    if (prefs.language !== undefined) updateData.language = prefs.language;
    if (prefs.uiMode !== undefined) updateData.uiMode = prefs.uiMode;
    if (prefs.theme !== undefined) updateData.theme = prefs.theme;
    if (prefs.sidebarMode !== undefined) updateData.sidebarMode = prefs.sidebarMode;
    if (prefs.sidebarPinned !== undefined) updateData.sidebarPinned = prefs.sidebarPinned;
    
    if (prefs.appearanceSettings !== undefined || prefs.layoutMode !== undefined) {
      // Merge into a plain JSON object first — the Prisma input type for JSON
      // columns is a union that cannot be spread directly.
      const mergedAppearance: Record<string, unknown> = {
        ...existingAppearance,
        ...(prefs.appearanceSettings || {}),
      };
      if (prefs.layoutMode !== undefined) mergedAppearance.layoutMode = prefs.layoutMode;
      updateData.appearanceSettings = mergedAppearance as Prisma.InputJsonValue;
    }
    if (prefs.disabledNotificationCategories !== undefined) updateData.disabledNotificationCategories = prefs.disabledNotificationCategories;
    if (prefs.notificationCategoryOverrides !== undefined) updateData.notificationCategoryOverrides = prefs.notificationCategoryOverrides;
    if (prefs.posShortcuts !== undefined) updateData.posShortcuts = prefs.posShortcuts;

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
