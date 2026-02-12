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
    const { data } = await apiClient.get('/user/preferences');
    return data.data as UserPreferencesDTO;
  },
  async upsert(payload: Partial<UserPreferencesDTO>): Promise<UserPreferencesDTO> {
    const { data } = await apiClient.post('/user/preferences', payload);
    return data.data as UserPreferencesDTO;
  }
};

