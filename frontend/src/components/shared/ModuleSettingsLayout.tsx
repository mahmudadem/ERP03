import React from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { Spinner } from '../ui/Spinner';

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
  const { t } = useTranslation('common');
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[var(--color-bg-primary)] relative">
      {/* Header */}
      <div className={`flex-none border-b border-gray-200 bg-white dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] ${isWindowsMode ? 'px-4 py-4 sm:px-6' : 'px-4 py-4 sm:px-8 sm:py-6'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {topActions}
        </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:flex-row">
        {/* Sidebar Navigation */}
        <aside className="flex-none border-b border-gray-200 bg-gray-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] lg:w-64 lg:border-b-0 lg:border-r">
          <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:p-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex min-w-max items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all lg:w-full lg:gap-3
                    ${isActive
                      ? 'bg-white dark:bg-[var(--color-bg-secondary)] text-indigo-700 dark:text-primary-400 shadow-sm ring-1 ring-gray-200 dark:ring-[var(--color-border)]'
                      : 'text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] hover:text-gray-900 dark:hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  <Icon
                    size={20}
                    aria-hidden="true"
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
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8 pb-32">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Floating global save bar at the bottom */}
      {hasChanges && (
        <div className="fixed inset-x-0 bottom-4 z-[100] mx-auto w-full max-w-2xl px-4 transition-all duration-300 sm:bottom-6 sm:px-6">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-900 p-4 text-white shadow-2xl dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <AlertTriangle size={18} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold">{t('settings.layout.unsavedTitle')}</div>
                <div className="text-[10px] text-slate-400">{t('settings.layout.unsavedDescription')}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {onDiscard && (
                <button
                  onClick={onDiscard}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg transition-all active:scale-95"
                >
                  <RotateCcw size={14} />
                  {t('settings.layout.discard')}
                </button>
              )}
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold rounded-lg shadow-lg transition-all active:scale-95"
                >
                  {saving ? (
                    <Spinner size="xs" variant="white" />
                  ) : (
                    <Save size={14} />
                  )}
                  {t('settings.layout.saveChanges')}
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
                <Spinner size="sm" variant="white" />
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
