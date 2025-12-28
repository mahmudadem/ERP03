import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useUserPreferences, SidebarMode, UiMode } from '../../../hooks/useUserPreferences';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { company } = useCompanyAccess();
  const { sidebarMode, setSidebarMode, uiMode, setUiMode } = useUserPreferences();

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
              <span>🎨</span> UI Appearance & Navigation
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">How you want the application to look and feel.</p>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
              {/* Sidebar Style */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sidebar Menu Style
                </label>
                <select
                  value={sidebarMode}
                  onChange={(e) => setSidebarMode(e.target.value as SidebarMode)}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm bg-white"
                >
                  <option value="classic">Standard (Accordion Expansion)</option>
                  <option value="submenus">Modern (Flyout Sub-menus)</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 italic">
                  Changes how you navigate between modules in the sidebar.
                </p>
              </div>

              {/* Layout Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Overall Application Layout
                </label>
                <select
                  value={uiMode}
                  onChange={(e) => setUiMode(e.target.value as UiMode)}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm bg-white"
                >
                  <option value="classic">Web Mode (Single View / Modals)</option>
                  <option value="windows">Windows Mode (Multi-window Desktop)</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 italic">
                  Switch between standard web navigation or a desktop-like multitasking experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
