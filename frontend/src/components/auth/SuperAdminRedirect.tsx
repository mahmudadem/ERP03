import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

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
      console.log('[SuperAdminRedirect] Redirecting super admin from', location.pathname, 'to /super-admin/overview');
      navigate('/super-admin/overview', { replace: true });
    }
  }, [isSuperAdmin, loading, location.pathname, navigate]);

  // While loading, show nothing to prevent flash
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // If super admin on regular route, show nothing (will redirect)
  if (isSuperAdmin && !location.pathname.startsWith('/super-admin')) {
    return null;
  }

  return <>{children}</>;
};
