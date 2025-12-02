
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { CompanySettingsProvider } from './context/CompanySettingsContext';
import { CompanyAccessProvider } from './context/CompanyAccessContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { setAuthTokenGetter } from './api/client';

const AxiosInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AxiosInitializer>
        <CompanyAccessProvider>
          <CompanySettingsProvider>
            <RouterProvider router={router} />
          </CompanySettingsProvider>
        </CompanyAccessProvider>
      </AxiosInitializer>
    </AuthProvider>
  );
};

export default App;
