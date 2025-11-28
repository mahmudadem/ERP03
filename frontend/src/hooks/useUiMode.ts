import { useUserPreferences } from './useUserPreferences';

export const useUiMode = () => {
  const { uiMode, setUiMode, toggleUiMode } = useUserPreferences();

  const isWindowsMode = uiMode === 'windows';
  const isClassicMode = uiMode === 'classic';

  return {
    uiMode,
    isWindowsMode,
    isClassicMode,
    setUiMode,
    toggleUiMode
  };
};