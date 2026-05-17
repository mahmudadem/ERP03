import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  LayoutTemplate,
  Users, 
  Building2, 
  Blocks, 
  Shield, 
  Layers, 
  Package, 
  FileText,
  Crown,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Search,
  Palette,
  Wrench,
  ShieldCheck,
  Bot,
  Server,
  Globe
} from 'lucide-react';
import { PageTitleManager } from '../components/common/PageTitleManager';
import { useTranslation } from 'react-i18next';
import { SuperAdminThemeProvider } from '../modules/super-admin/theme/SuperAdminThemeProvider';

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
{ path: '/super-admin/ai-tools', label: t('shell.superAdmin.nav.aiTools'), icon: Wrench },
    { path: '/super-admin/ai-providers', label: t('shell.superAdmin.nav.aiProviders'), icon: Server },
    { path: '/super-admin/platform-global-providers', label: t('shell.superAdmin.nav.aiRuntimeProfiles', { defaultValue: 'Platform Global Providers' }), icon: Globe },
    { path: '/super-admin/ai-models', label: t('shell.superAdmin.nav.aiModels'), icon: Bot },
    { path: '/super-admin/ai-proposal-policies', label: t('shell.superAdmin.nav.aiProposalPolicies', { defaultValue: 'AI Proposals' }), icon: ShieldCheck },
    { path: '/super-admin/system-forms', label: t('shell.superAdmin.nav.systemForms', { defaultValue: 'System Forms' }), icon: LayoutTemplate },
    { path: '/super-admin/voucher-templates', label: t('shell.superAdmin.nav.voucherTemplates', { defaultValue: 'Voucher Templates' }), icon: FileText },
    { path: '/super-admin/appearance', label: t('shell.superAdmin.nav.appearance', { defaultValue: 'Appearance Lab' }), icon: Palette },
  ];

  const handleLogout = async () => {
    if (window.confirm(t('shell.superAdmin.confirmLogout'))) {
      await logout();
      navigate('/admin/login');
    }
  };

  return (
    <SuperAdminThemeProvider>
    <div className="min-h-screen flex bg-[var(--sa-bg)] text-[var(--sa-text)]">
      <PageTitleManager />
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen border-r border-[var(--sa-border)] bg-[var(--sa-sidebar-bg)]
          transition-all duration-300 z-40
          ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20'}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="border-b border-[var(--sa-border)] p-5">
            {isSidebarOpen ? (
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--sa-radius)] bg-[var(--sa-accent)]">
                    <Crown className="h-5 w-5 text-[var(--sa-accent-contrast)]" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold text-[var(--sa-sidebar-text)]">{t('shell.superAdmin.title')}</h1>
                    <p className="text-xs text-[var(--sa-sidebar-muted)]">{t('shell.superAdmin.systemDashboard')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--sa-radius)] bg-[var(--sa-accent)]">
                  <Crown className="h-5 w-5 text-[var(--sa-accent-contrast)]" />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors group
                    ${isActive
                      ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-contrast)]'
                      : 'text-[var(--sa-sidebar-text)] hover:bg-[var(--sa-sidebar-hover)]'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--sa-accent-contrast)]' : 'text-[var(--sa-sidebar-muted)]'}`} />
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
          <div className="border-t border-[var(--sa-border)] p-3">
            {isSidebarOpen ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-[var(--sa-radius)] bg-[var(--sa-sidebar-hover)] px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sa-accent)] text-sm font-semibold text-[var(--sa-accent-contrast)]">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--sa-sidebar-text)]">{user?.email}</p>
                    <p className="text-xs text-[var(--sa-sidebar-muted)]">{t('shell.superAdmin.superAdministrator')}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('shell.superAdmin.logout')}</span>
                </button>
              </div>
            ) : (
              <div className="hidden lg:block space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sa-accent)] text-sm font-semibold text-[var(--sa-accent-contrast)]">
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
        className="fixed left-4 top-4 z-50 rounded-[var(--sa-radius)] bg-[var(--sa-accent)] p-2 text-[var(--sa-accent-contrast)] shadow-lg lg:hidden"
      >
        {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="border-b border-[var(--sa-border)] bg-[var(--sa-surface)] px-5 py-3 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden items-center gap-2 rounded-md px-2 py-1.5 text-[var(--sa-muted)] transition-colors hover:bg-[var(--sa-surface-muted)] hover:text-[var(--sa-text)] lg:flex"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="ml-4 hidden max-w-md flex-1 items-center gap-2 rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface-muted)] px-3 py-2 text-sm text-[var(--sa-muted)] md:flex">
              <Search className="h-4 w-4" />
              <span>System owner workspace</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface-muted)] px-3 py-1">
                <span className="text-sm font-medium text-[var(--sa-text)]">{t('shell.superAdmin.systemAdminPanel')}</span>
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
    </SuperAdminThemeProvider>
  );
};
