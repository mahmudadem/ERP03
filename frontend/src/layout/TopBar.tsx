
import React from 'react';
import { useCompanyContext } from '../hooks/useCompanyContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { Button } from '../components/ui/Button';
import { SwitchCompanyButton } from '../components/company/SwitchCompanyButton';

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { company } = useCompanyContext();
  const { uiMode, toggleUiMode, toggleTheme } = useUserPreferences();

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
          <span className="font-bold text-gray-800 leading-tight">{company.name}</span>
          <span className="text-xs text-gray-500">{company.baseCurrency} • FY 2024</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 mr-4 border-r pr-4">
           <Button variant="ghost" size="sm" onClick={toggleUiMode}>
             {uiMode === 'classic' ? '🖥️ Switch to Windows' : '🌐 Switch to Web'}
           </Button>
           <Button variant="ghost" size="sm" onClick={toggleTheme}>
             Theme
           </Button>
        </div>

        <SwitchCompanyButton />

        <div className="h-8 w-8 bg-blue-600 rounded-full text-white flex items-center justify-center font-bold text-sm">
          A
        </div>
      </div>
    </header>
  );
};
