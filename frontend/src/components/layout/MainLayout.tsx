import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { NavItem } from '../../types';

interface MainLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Accounting', path: '/accounting' },
  { label: 'Inventory', path: '/inventory' },
  { label: 'HR', path: '/hr' },
  { label: 'POS', path: '/pos' },
  { label: 'Designer Engine', path: '/designer' },
  { label: 'Settings', path: '/settings' },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar navItems={NAV_ITEMS} isOpen={isSidebarOpen} />
      
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <header className="h-16 bg-white border-b shadow-sm flex items-center justify-between px-6 sticky top-0 z-10">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            {/* Hamburger Icon Placeholder */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-accent rounded-full text-white flex items-center justify-center font-bold">
              U
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};