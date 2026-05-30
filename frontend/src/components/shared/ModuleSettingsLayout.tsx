import React from 'react';
import { LucideIcon, Save, RotateCcw, AlertTriangle } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ModuleSettingsLayoutProps {
  title: string;
  subtitle?: string;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  topActions?: React.ReactNode;
  hasChanges?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  saving?: boolean;
}

export const ModuleSettingsLayout: React.FC<ModuleSettingsLayoutProps> = ({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  topActions,
  hasChanges = false,
  onSave,
  onDiscard,
  saving = false
}) => {
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[var(--color-bg-primary)] relative">
      {/* Header */}
      <div className="flex-none px-8 py-6 bg-white dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {topActions}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-primary)] overflow-y-auto block">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white dark:bg-[var(--color-bg-secondary)] text-indigo-700 dark:text-primary-400 shadow-sm ring-1 ring-gray-200 dark:ring-[var(--color-border)]'
                      : 'text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] hover:text-gray-900 dark:hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  <Icon
                    size={20}
                    className={isActive ? 'text-indigo-600 dark:text-primary-400' : 'text-gray-400 dark:text-[var(--color-text-muted)]'}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[var(--color-bg-secondary)]">
          <div className="p-8">
            <div className="max-w-4xl mx-auto space-y-8 pb-32">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Floating global save bar at the bottom */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc((100vw-var(--app-sidebar-width))/2+var(--app-sidebar-width))] md:translate-x-[-50%] z-[100] w-full max-w-2xl px-6 transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 shadow-2xl border border-slate-800/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <AlertTriangle size={18} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold">Unsaved Settings Changes</div>
                <div className="text-[10px] text-slate-400">You have unsaved changes in this module.</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onDiscard && (
                <button
                  onClick={onDiscard}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  <RotateCcw size={14} />
                  Discard
                </button>
              )}
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SettingsSectionProps {
  title: string;
  description: string;
  onSave: () => void;
  disabled?: boolean;
  saving?: boolean;
  saveLabel?: string;
  hideSaveButton?: boolean;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  onSave,
  disabled,
  saving,
  saveLabel = 'Save Settings',
  hideSaveButton = false,
  children
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-1">{title}</h2>
            <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">{description}</p>
          </div>
          {!hideSaveButton && (
            <button
              onClick={onSave}
              disabled={disabled || saving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm font-bold active:scale-95 whitespace-nowrap"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving ? 'Saving...' : saveLabel}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};
