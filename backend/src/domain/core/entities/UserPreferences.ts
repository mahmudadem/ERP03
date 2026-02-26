export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';
export type SidebarMode = 'classic' | 'submenus';

export class UserPreferences {
  constructor(
    public userId: string,
    public language: string = 'en',
    public uiMode: UiMode = 'windows',
    public theme: Theme = 'light',
    public sidebarMode: SidebarMode = 'classic',
    public sidebarPinned: boolean = true,
    public disabledNotificationCategories: string[] = [],
    public notificationCategoryOverrides: Record<string, boolean> = {},
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}
