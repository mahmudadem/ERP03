import { useUserPreferences } from './useUserPreferences';

export const useLayoutMode = () => {
  const { layoutMode, setLayoutMode, toggleLayoutMode } = useUserPreferences();
  return {
    layoutMode,
    isCompact: layoutMode === 'compact',
    isLegacy: layoutMode === 'legacy',
    setLayoutMode,
    toggleLayoutMode,
  };
};
