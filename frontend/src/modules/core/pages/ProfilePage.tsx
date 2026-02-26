import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useUserPreferences, SidebarMode, UiMode } from '../../../hooks/useUserPreferences';
import { userPreferencesApi } from '../../../api/userPreferencesApi';
import { useTranslation } from 'react-i18next';

const notificationCategories = [
  { id: 'APPROVAL', name: 'Financial Approvals', desc: 'Approval required notifications for accounting workflow.' },
  { id: 'CUSTODY', name: 'Custody Confirmations', desc: 'Custody confirmation requests assigned to you.' },
  { id: 'SYSTEM', name: 'System Info', desc: 'General information and non-critical system updates.' },
  { id: 'WARNING', name: 'System Warnings', desc: 'Warnings and alert-style notifications.' }
];

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { company } = useCompanyAccess();
  const { settings: companySettings } = useCompanySettings();
  const { sidebarMode, setSidebarMode, uiMode, setUiMode, language, setLanguage, savePreferences, loadingFromServer } = useUserPreferences();
  const { t } = useTranslation('common');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [notificationOverrides, setNotificationOverrides] = useState<Record<string, boolean>>({});
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsMsg, setNotificationsMsg] = useState<string | null>(null);
  const [notificationsStatus, setNotificationsStatus] = useState<'success' | 'error' | null>(null);

  // Auto-clear status message after a few seconds
  React.useEffect(() => {
    if (!saveStatus) return;
    const timer = setTimeout(() => {
      setSaveMsg(null);
      setSaveStatus(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  React.useEffect(() => {
    if (!notificationsStatus) return;
    const timer = setTimeout(() => {
      setNotificationsMsg(null);
      setNotificationsStatus(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [notificationsStatus]);

  React.useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;

    const loadNotificationOverrides = async () => {
      setNotificationsLoading(true);
      try {
        const prefs = await userPreferencesApi.get();
        if (cancelled) return;

        const explicitOverrides = prefs.notificationCategoryOverrides || {};
        if (Object.keys(explicitOverrides).length > 0) {
          setNotificationOverrides(explicitOverrides);
          return;
        }

        // Backward compatibility with legacy disabled list.
        const legacyDisabled = prefs.disabledNotificationCategories || [];
        if (legacyDisabled.length > 0) {
          const mapped = legacyDisabled.reduce((acc, categoryId) => {
            acc[categoryId] = false;
            return acc;
          }, {} as Record<string, boolean>);
          setNotificationOverrides(mapped);
        } else {
          setNotificationOverrides({});
        }
      } catch {
        if (!cancelled) {
          setNotificationOverrides({});
        }
      } finally {
        if (!cancelled) {
          setNotificationsLoading(false);
        }
      }
    };

    loadNotificationOverrides();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const companyDisabledCategories = new Set(companySettings?.disabledNotificationCategories || []);

  const getOverrideMode = (categoryId: string): 'inherit' | 'on' | 'off' => {
    const value = notificationOverrides[categoryId];
    if (typeof value !== 'boolean') return 'inherit';
    return value ? 'on' : 'off';
  };

  const setOverrideMode = (categoryId: string, mode: 'inherit' | 'on' | 'off') => {
    setNotificationOverrides((prev) => {
      const next = { ...prev };
      if (mode === 'inherit') {
        delete next[categoryId];
      } else {
        next[categoryId] = mode === 'on';
      }
      return next;
    });
  };

  const getEffectiveCategoryState = (categoryId: string): boolean => {
    const override = notificationOverrides[categoryId];
    if (typeof override === 'boolean') return override;
    return !companyDisabledCategories.has(categoryId);
  };

  const saveNotificationOverrides = async () => {
    setNotificationsSaving(true);
    setNotificationsMsg(null);
    setNotificationsStatus(null);
    try {
      await userPreferencesApi.upsert({
        notificationCategoryOverrides: notificationOverrides,
        // Clear legacy list to avoid conflict with explicit override logic.
        disabledNotificationCategories: []
      });
      setNotificationsMsg('Notification overrides saved.');
      setNotificationsStatus('success');
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Could not save notification overrides.';
      setNotificationsMsg(apiMessage);
      setNotificationsStatus('error');
    } finally {
      setNotificationsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.title', 'User Profile & Settings')}</h1>
      
      <div className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('profile.personalTitle', 'Personal Information')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('profile.personalDesc', 'Details about your account and company access.')}</p>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">{t('profile.fullName', 'Full name')}</dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">{user?.displayName || 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">{t('profile.email', 'Email address')}</dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">{user?.email}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">{t('profile.userId', 'User ID')}</dt>
                <dd className="mt-1 text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                  {user?.uid}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">{t('profile.company', 'Current Company')}</dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">
                  {company?.name || 'No company selected'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* UI Customization */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
              <span>🎨</span> {t('profile.uiTitle', 'UI Appearance & Navigation')}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('profile.uiSubtitle', 'How you want the application to look and feel.')}</p>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
              {/* Sidebar Style */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.sidebarLabel', 'Sidebar Menu Style')}
                </label>
                <select
                  value={sidebarMode}
                  onChange={(e) => setSidebarMode(e.target.value as SidebarMode)}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm bg-white"
                >
                  <option value="classic">{t('profile.sidebarClassic', 'Standard (Accordion Expansion)')}</option>
                  <option value="submenus">{t('profile.sidebarSubmenus', 'Modern (Flyout Sub-menus)')}</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 italic">
                  {t('profile.sidebarHint', 'Changes how you navigate between modules in the sidebar.')}
                </p>
              </div>

              {/* Layout Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.layoutLabel', 'Overall Application Layout')}
                </label>
                <select
                  value={uiMode}
                  onChange={(e) => setUiMode(e.target.value as UiMode)}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm bg-white"
                >
                  <option value="classic">{t('profile.layoutClassic', 'Web Mode (Single View / Modals)')}</option>
                  <option value="windows">{t('profile.layoutWindows', 'Windows Mode (Multi-window Desktop)')}</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 italic">
                  {t('profile.layoutHint', 'Switch between standard web navigation or a desktop-like multitasking experience.')}
                </p>
              </div>

              {/* Language Preference */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('language.label', 'Language')}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm bg-white"
                >
                  <option value="en">{t('language.english', 'English')}</option>
                  <option value="ar">{t('language.arabic', 'Arabic')}</option>
                  <option value="tr">{t('language.turkish', 'Turkish')}</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 italic">
                  {t('language.description', 'Applies to menus, pages, and vouchers you see.')}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-6">
              <button
                onClick={async () => {
                  setSaving(true);
                  setSaveMsg(null);
                  setSaveStatus(null);
                  try {
                    await savePreferences();
                    setSaveMsg(t('profile.saved', 'Preferences saved.'));
                    setSaveStatus('success');
                  } catch (err: any) {
                    const apiMessage =
                      err?.response?.data?.error?.message ||
                      err?.message ||
                      t('profile.saveError', 'Could not save preferences.');
                    setSaveMsg(apiMessage);
                    setSaveStatus('error');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || loadingFromServer}
                className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('profile.saving', 'Saving...') : t('profile.saveBtn', 'Save Preferences')}
              </button>
              {saveMsg && (
                <span
                  className={`text-xs ${
                    saveStatus === 'error' ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notification Overrides */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Notification Overrides</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Company defaults are applied first. You can override each category for your own account.
            </p>
          </div>
          <div className="px-4 py-5 sm:px-6 space-y-4">
            {notificationsLoading ? (
              <div className="text-sm text-gray-500">Loading notification preferences...</div>
            ) : (
              <>
                {notificationCategories.map((category) => {
                  const mode = getOverrideMode(category.id);
                  const effectiveEnabled = getEffectiveCategoryState(category.id);
                  return (
                    <div key={category.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{category.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{category.desc}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Company default: {companyDisabledCategories.has(category.id) ? 'Off' : 'On'} | Effective for you: {effectiveEnabled ? 'On' : 'Off'}
                          </div>
                        </div>
                        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => setOverrideMode(category.id, 'inherit')}
                            className={`px-3 py-1.5 text-xs font-semibold border-r border-gray-200 ${
                              mode === 'inherit' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Inherit
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideMode(category.id, 'on')}
                            className={`px-3 py-1.5 text-xs font-semibold border-r border-gray-200 ${
                              mode === 'on' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideMode(category.id, 'off')}
                            className={`px-3 py-1.5 text-xs font-semibold ${
                              mode === 'off' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Off
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center gap-2">
                  <button
                    onClick={saveNotificationOverrides}
                    disabled={notificationsSaving}
                    className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {notificationsSaving ? 'Saving...' : 'Save Notification Overrides'}
                  </button>
                  {notificationsMsg && (
                    <span className={`text-xs ${notificationsStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                      {notificationsMsg}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
