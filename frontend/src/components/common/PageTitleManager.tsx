
import React, { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { routesConfig } from '../../router/routes.config';

export const PageTitleManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Find matching route in config
    const currentRoute = routesConfig.find(route => 
      matchPath({ path: route.path, end: true }, location.pathname)
    );

    if (currentRoute) {
      document.title = `${currentRoute.label} | ERP03`;
    } else {
      // Logic for dynamic routes with params like /accounting/vouchers/:id
      const dynamicRoute = routesConfig.find(route => 
        matchPath({ path: route.path, end: false }, location.pathname)
      );

      if (dynamicRoute) {
        document.title = `${dynamicRoute.label} | ERP03`;
      } else {
        document.title = 'ERP03 Platform';
      }
    }
  }, [location.pathname]);

  return null; // This component doesn't render anything
};
