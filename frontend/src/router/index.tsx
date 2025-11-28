import React, { Suspense } from 'react';
import { createHashRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { routesConfig } from './routes.config';
import { Navigate } from 'react-router-dom';

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
    <span>Loading resource...</span>
  </div>
);

// Map config to Router objects
const routes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      ...routesConfig.map((route) => ({
        path: route.path === '/' ? undefined : route.path.replace(/^\//, ''), // Handle root index vs paths
        index: route.path === '/',
        element: (
          <Suspense fallback={<PageLoader />}>
            <route.component />
          </Suspense>
        ),
      })),
      {
        path: '*',
        element: <Navigate to="/" replace />,
      }
    ],
  },
];

export const router = createHashRouter(routes);