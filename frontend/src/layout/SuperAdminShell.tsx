import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Blocks, 
  Shield, 
  Layers, 
  Package, 
  Crown,
  LogOut,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { PageTitleManager } from '../components/common/PageTitleManager';
import { useTranslation } from 'react-i18next';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<any>;
}

export const SuperAdminShell: React.FC = () => {
  const { t } = useTranslation('common');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems: NavItem[] = [
    { path: '/super-admin/overview', label: t('shell.superAdmin.nav.overview'), icon: LayoutDashboard },
    { path: '/super-admin/users', label: t('shell.superAdmin.nav.users'), icon: Users },
    { path: '/super-admin/companies', label: t('shell.superAdmin.nav.companies'), icon: Building2 },
    { path: '/super-admin/business-domains', label: t('shell.superAdmin.nav.businessDomains'), icon: Blocks },
    { path: '/super-admin/modules-registry', label: t('shell.superAdmin.nav.modules'), icon: Layers },
    { path: '/super-admin/permissions-registry', label: t('shell.superAdmin.nav.permissions'), icon: Shield },
    { path: '/super-admin/bundles-manager', label: t('shell.superAdmin.nav.bundles'), icon: Package },
    { path: '/super-admin/plans', label: t('shell.superAdmin.nav.plans'), icon: Crown },
  ];

  const handleLogout = async () => {
    if (window.confirm(t('shell.superAdmin.confirmLogout'))) {
      await logout();
      navigate('/admin/login');
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <PageTitleManager />
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen bg-slate-900/95 backdrop-blur-xl border-r border-purple-500/20
          transition-all duration-300 z-40
          ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20'}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-purple-500/20">
            {isSidebarOpen ? (
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-white font-bold text-lg">{t('shell.superAdmin.title')}</h1>
                    <p className="text-purple-300 text-xs">{t('shell.superAdmin.systemDashboard')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex justify-center">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all group
                    ${isActive
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-purple-400'}`} />
                  {isSidebarOpen && (
                    <span className="font-medium">{item.label}</span>
                  )}
                  {isActive && isSidebarOpen && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-purple-500/20">
            {isSidebarOpen ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-purple-300 text-xs">{t('shell.superAdmin.superAdministrator')}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">{t('shell.superAdmin.logout')}</span>
                </button>
              </div>
            ) : (
              <div className="hidden lg:block space-y-3">
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex justify-center items-center py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
      >
        {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-purple-500/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 ml-auto">
              <div className="px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                <span className="text-purple-300 text-sm font-medium">{t('shell.superAdmin.systemAdminPanel')}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
