
import { useMemo } from 'react';
import { routesConfig } from '../router/routes.config';

export const useSidebarConfig = () => {
  const sidebarSections = useMemo(() => {
    // Group routes by section
    const groups: Record<string, any[]> = {
      CORE: [],
      ACCOUNTING: [],
      INVENTORY: [],
      HR: [],
      POS: [],
      SETTINGS: []
    };

    routesConfig.forEach(route => {
      if (!route.hideInMenu && groups[route.section]) {
        groups[route.section].push(route);
      }
    });

    return groups;
  }, []);

  return sidebarSections;
};
