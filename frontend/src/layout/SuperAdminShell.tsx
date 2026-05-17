import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Crown,
  LogOut,
  Menu,
  X,
  Search
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { PageTitleManager } from '../components/common/PageTitleManager';
import { useTranslation } from 'react-i18next';
import { SuperAdminThemeProvider } from '../modules/super-admin/theme/SuperAdminThemeProvider';
export const SuperAdminShell: React.FC = () => {
  const { t } = useTranslation('common');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sections = useSidebarConfig();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

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
          <nav className="flex-1 overflow-y-auto p-3 space-y-6">
            {Object.entries(sections).map(([sectionTitle, sectionData]: [string, any]) => {
              const SectionIcon = (Icons as any)[sectionData.icon] || Icons.Folder;
              return (
                <div key={sectionTitle} className="space-y-1">
                  {/* Section Header */}
                  {isSidebarOpen ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[var(--sa-sidebar-muted)] uppercase tracking-wider">
                      <SectionIcon className="w-4 h-4" />
                      <span>{sectionTitle}</span>
                    </div>
                  ) : (
                    <div className="flex justify-center py-2" title={sectionTitle}>
                      <SectionIcon className="w-5 h-5 text-[var(--sa-sidebar-muted)]" />
                    </div>
                  )}

                  {/* Section Items */}
                  {sectionData.items.map((item: any) => {
                    if (item.children) {
                      const isGroupOpen = openGroups[item.label] ?? true;
                      return (
                        <div key={item.label} className="space-y-1">
                          <button
                            onClick={() => toggleGroup(item.label)}
                            className={`
                              w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors group
                              text-[var(--sa-sidebar-text)] hover:bg-[var(--sa-sidebar-hover)]
                            `}
                          >
                            <div className="flex items-center gap-3">
                              {item.icon && (Icons as any)[item.icon] ? (
                                (() => { const ItemIcon = (Icons as any)[item.icon]; return <ItemIcon className="w-4 h-4 text-[var(--sa-sidebar-muted)]" /> })()
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--sa-sidebar-muted)] ml-1 mr-1" />
                              )}
                              {isSidebarOpen && <span className="font-medium text-[var(--sa-sidebar-muted)]">{item.label}</span>}
                            </div>
                            {isSidebarOpen && (
                              <Icons.ChevronDown className={`w-4 h-4 text-[var(--sa-sidebar-muted)] transition-transform ${isGroupOpen ? '' : '-rotate-90'}`} />
                            )}
                          </button>
                          {isGroupOpen && isSidebarOpen && (
                            <div className="ml-6 space-y-1 border-l border-[var(--sa-border)] pl-2">
                              {item.children.map((child: any) => {
                                const isActive = location.pathname === child.path;
                                return (
                                  <Link
                                    key={child.path}
                                    to={child.path}
                                    className={`
                                      block rounded-md px-3 py-2 text-sm transition-colors
                                      ${isActive
                                        ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-contrast)]'
                                        : 'text-[var(--sa-sidebar-text)] hover:bg-[var(--sa-sidebar-hover)]'
                                      }
                                    `}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors group
                          ${isActive
                            ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-contrast)]'
                            : 'text-[var(--sa-sidebar-text)] hover:bg-[var(--sa-sidebar-hover)]'
                          }
                        `}
                        title={!isSidebarOpen ? item.label : undefined}
                      >
                        {item.icon && (Icons as any)[item.icon] ? (
                          (() => { const ItemIcon = (Icons as any)[item.icon]; return <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--sa-accent-contrast)]' : 'text-[var(--sa-sidebar-muted)]'}`} /> })()
                        ) : (
                          <div className={`w-1.5 h-1.5 shrink-0 rounded-full ml-1 mr-1 ${isActive ? 'bg-[var(--sa-accent-contrast)]' : 'bg-[var(--sa-sidebar-muted)]'}`} />
                        )}
                        {isSidebarOpen && (
                          <span className="font-medium">{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
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
