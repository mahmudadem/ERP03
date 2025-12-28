
import { useUserPreferencesContext } from '../context/UserPreferencesContext';

export type { UiMode, Theme, SidebarMode } from '../context/UserPreferencesContext';

export const useUserPreferences = () => {
  return useUserPreferencesContext();
};
