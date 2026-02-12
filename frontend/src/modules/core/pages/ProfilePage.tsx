import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useUserPreferences, SidebarMode, UiMode } from '../../../hooks/useUserPreferences';
import { useTranslation } from 'react-i18next';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { company } = useCompanyAccess();
  const { sidebarMode, setSidebarMode, uiMode, setUiMode, language, setLanguage, savePreferences, loadingFromServer } = useUserPreferences();
  const { t } = useTranslation('common');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);

  // Auto-clear status message after a few seconds
  React.useEffect(() => {
    if (!saveStatus) return;
    const timer = setTimeout(() => {
      setSaveMsg(null);
      setSaveStatus(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Profile & Settings</h1>
      
      <div className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Personal Information</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about your account and company access.</p>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Full name</dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">{user?.displayName || 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">{user?.email}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">User ID</dt>
                <dd className="mt-1 text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                  {user?.uid}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Current Company</dt>
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
                  } catch {
                    setSaveMsg(t('profile.saveError', 'Could not save preferences.'));
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
      </div>
    </div>
  );
};

export default ProfilePage;
