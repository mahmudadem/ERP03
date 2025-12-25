
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { CompanySettingsProvider } from './context/CompanySettingsContext';
import { CompanyAccessProvider } from './context/CompanyAccessContext';
import { AuthProvider } from './context/AuthContext';
import { WindowManagerProvider } from './context/WindowManagerContext';
import { QueryProvider } from './providers/QueryProvider';
import { useAuth } from './hooks/useAuth';
import { setAuthTokenGetter, setCompanyIdGetter } from './api/client';
import { useCompanyAccess } from './context/CompanyAccessContext';

const AxiosInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken } = useAuth();
  const { companyId } = useCompanyAccess();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    setCompanyIdGetter(() => companyId || null);
  }, [companyId]);

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <QueryProvider>
      <AuthProvider>
        <CompanyAccessProvider>
          <AxiosInitializer>
            <CompanySettingsProvider>
              <WindowManagerProvider>
                <RouterProvider router={router} />
              </WindowManagerProvider>
            </CompanySettingsProvider>
          </AxiosInitializer>
        </CompanyAccessProvider>
      </AuthProvider>
    </QueryProvider>
  );
};

export default App;
