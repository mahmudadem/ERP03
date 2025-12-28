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
    <header className={clsx(
      "h-16 flex items-center justify-between px-4 sticky top-0 z-30 transition-all duration-300",
      "bg-[rgba(var(--color-bg-primary-rgb),0.8)] backdrop-blur-md border-b border-[var(--color-border)] shadow-sm"
    )}>
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded lg:hidden"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="flex flex-col">
          <span className="font-bold text-[var(--color-text-primary)] leading-tight">{company?.name || 'No Company'}</span>
          <span className="text-xs text-[var(--color-text-secondary)]">{company?.baseCurrency || 'USD'} • FY 2024</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-3 px-4">
           {/* UI Mode Toggle */}
           <div className="flex bg-[var(--color-bg-tertiary)] p-1 rounded-lg">
             <button
               onClick={() => setUiMode('windows')}
               className={clsx(
                 "px-3 py-1 text-xs font-medium rounded-md transition-all",
                 uiMode === 'windows' 
                  ? "bg-[var(--color-bg-primary)] text-primary-600 shadow-sm" 
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
               )}
             >
               🖥️ Windows
             </button>
             <button
               onClick={() => setUiMode('classic')}
               className={clsx(
                 "px-3 py-1 text-xs font-medium rounded-md transition-all",
                 uiMode === 'classic' 
                  ? "bg-[var(--color-bg-primary)] text-primary-600 shadow-sm" 
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
               )}
             >
               🌐 Web
             </button>
           </div>

           {/* Theme Toggle (Simplified) */}
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleTheme} 
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
           >
             {theme === 'light' ? '🌙' : '☀️'}
           </Button>
        </div>

        <Menu as="div" className="relative ml-3">
          <div>
            <Menu.Button className="flex max-w-xs items-center rounded-full bg-[var(--color-bg-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
              <span className="sr-only">Open user menu</span>
              <div className="h-8 w-8 bg-primary-600 rounded-full text-white flex items-center justify-center font-bold text-sm hover:bg-primary-700 transition-colors">
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
            <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-[var(--color-bg-primary)] py-1 shadow-lg border border-[var(--color-border)] focus:outline-none">
              <div className="px-4 py-2 border-b border-[var(--color-border)]">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{user?.displayName || 'User'}</p>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">{user?.email}</p>
              </div>
              
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => navigate('/profile')}
                    className={clsx(
                      "block w-full px-4 py-2 text-left text-sm transition-colors",
                      active ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
                    )}
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
                    className={clsx(
                      "block w-full px-4 py-2 text-left text-sm transition-colors",
                      active ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    Switch Company
                  </button>
                )}
              </Menu.Item>
              
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={logout}
                    className={clsx(
                      "block w-full px-4 py-2 text-left text-sm transition-colors",
                      active ? "bg-[var(--color-bg-tertiary)] text-danger-600" : "text-danger-500"
                    )}
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
