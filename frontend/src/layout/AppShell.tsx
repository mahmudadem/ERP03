import { useState } from 'react';
import { Outlet } from 'react-router-dom'; // Important for nested routing
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useUserPreferences } from '../hooks/useUserPreferences';

export const AppShell: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { uiMode } = useUserPreferences();

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onNavigate={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div 
        className={`
          flex-1 flex flex-col h-screen transition-all duration-300
          ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
        `}
      >
        <TopBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="flex-1 relative overflow-hidden bg-gray-50/50">
          <div className="h-full overflow-y-auto p-4 md:p-6 custom-scroll">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};