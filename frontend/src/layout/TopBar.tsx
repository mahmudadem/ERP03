import React, { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { Menu, Transition } from '@headlessui/react';

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { company } = useCompanyAccess();
  const { uiMode, setUiMode, theme, toggleTheme } = useUserPreferences();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const userInitial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U');

  return (
    <header className="h-16 bg-white border-b shadow-sm flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded lg:hidden"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="flex flex-col">
          <span className="font-bold text-gray-800 leading-tight">{company?.name || 'No Company'}</span>
          <span className="text-xs text-gray-500">{company?.baseCurrency || 'USD'} • FY 2024</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-3 px-4">
           {/* UI Mode Toggle */}
           <div className="flex bg-gray-100 p-1 rounded-lg">
             <button
               onClick={() => setUiMode('windows')}
               className={clsx(
                 "px-3 py-1 text-xs font-medium rounded-md transition-all",
                 uiMode === 'windows' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
               )}
             >
               🖥️ Windows
             </button>
             <button
               onClick={() => setUiMode('classic')}
               className={clsx(
                 "px-3 py-1 text-xs font-medium rounded-md transition-all",
                 uiMode === 'classic' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
               )}
             >
               🌐 Web
             </button>
           </div>

           {/* Theme Toggle (Simplified) */}
           <Button variant="ghost" size="sm" onClick={toggleTheme} className="text-gray-500 hover:text-gray-700">
             {theme === 'light' ? '🌙' : '☀️'}
           </Button>
        </div>

        <Menu as="div" className="relative ml-3">
          <div>
            <Menu.Button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span className="sr-only">Open user menu</span>
              <div className="h-8 w-8 bg-blue-600 rounded-full text-white flex items-center justify-center font-bold text-sm hover:bg-blue-700 transition-colors">
                {userInitial}
              </div>
            </Menu.Button>
          </div>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => navigate('/profile')}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } block w-full px-4 py-2 text-left text-sm text-gray-700`}
                  >
                    Your Profile
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => {
                        setUiMode('classic');
                        navigate('/company-selector');
                    }}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } block w-full px-4 py-2 text-left text-sm text-gray-700`}
                  >
                    Switch Company
                  </button>
                )}
              </Menu.Item>
              
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={logout}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } block w-full px-4 py-2 text-left text-sm text-gray-700`}
                  >
                    Sign out
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  );
};
