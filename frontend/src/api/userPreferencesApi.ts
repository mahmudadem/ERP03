import apiClient from './client';

export interface UserPreferencesDTO {
  language: string;
  uiMode: 'classic' | 'windows';
  theme: 'light' | 'dark';
  sidebarMode: 'classic' | 'submenus';
  sidebarPinned: boolean;
  disabledNotificationCategories?: string[];
  notificationCategoryOverrides?: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: string;
}

const extractPrefs = (resp: any): UserPreferencesDTO => {
  if (!resp) return {} as UserPreferencesDTO;
  if (resp.preferences) return resp.preferences as UserPreferencesDTO;
  if (resp.data?.preferences) return resp.data.preferences as UserPreferencesDTO;
  if (resp.data) return resp.data as UserPreferencesDTO;
  return resp as UserPreferencesDTO;
};

export const userPreferencesApi = {
  async get(): Promise<UserPreferencesDTO> {
    const resp = await apiClient.get('/user/preferences');
    return extractPrefs(resp);
  },
  async upsert(payload: Partial<UserPreferencesDTO>): Promise<UserPreferencesDTO> {
    const resp = await apiClient.post('/user/preferences', payload);
    return extractPrefs(resp);
  }
};
