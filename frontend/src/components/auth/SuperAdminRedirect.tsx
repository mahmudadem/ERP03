import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { Spinner } from '../ui/Spinner';

/**
 * SuperAdminRedirect
 * 
 * Ensures super admins are always in the /super-admin routes
 * Prevents them from accessing regular user routes
 */
export const SuperAdminRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, loading } = useCompanyAccess();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    const isOnSuperAdminRoute = location.pathname.startsWith('/super-admin');
    
    // If super admin is NOT on a super admin route, redirect them
    if (isSuperAdmin && !isOnSuperAdminRoute) {
      navigate('/super-admin/overview', { replace: true });
    }
  }, [isSuperAdmin, loading, location.pathname, navigate]);

  // While loading, show nothing to prevent flash
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" variant="primary" />
      </div>
    );
  }

  // If super admin on regular route, show nothing (will redirect)
  if (isSuperAdmin && !location.pathname.startsWith('/super-admin')) {
    return null;
  }

  return <>{children}</>;
};
