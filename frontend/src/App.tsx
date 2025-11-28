
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { CompanySettingsProvider } from './context/CompanySettingsContext';

const App: React.FC = () => {
  return (
    <CompanySettingsProvider>
      <RouterProvider router={router} />
    </CompanySettingsProvider>
  );
};

export default App;
