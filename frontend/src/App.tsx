
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { CompanySettingsProvider } from './context/CompanySettingsContext';
import { CompanyAccessProvider } from './context/CompanyAccessContext';

const App: React.FC = () => {
  return (
    <CompanySettingsProvider>
      <CompanyAccessProvider>
        <RouterProvider router={router} />
      </CompanyAccessProvider>
    </CompanySettingsProvider>
  );
};

export default App;
