import apiClient from './client';

export interface UserPreferencesDTO {
  language: string;
  uiMode: 'classic' | 'windows';
  theme: 'light' | 'dark';
  sidebarMode: 'classic' | 'submenus';
  sidebarPinned: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const userPreferencesApi = {
  async get(): Promise<UserPreferencesDTO> {
    const resp = await apiClient.get('/user/preferences');
    const prefs = (resp as any)?.data ?? resp;
    return prefs as UserPreferencesDTO;
  },
  async upsert(payload: Partial<UserPreferencesDTO>): Promise<UserPreferencesDTO> {
    const resp = await apiClient.post('/user/preferences', payload);
    const prefs = (resp as any)?.data ?? resp;
    return prefs as UserPreferencesDTO;
  }
};
