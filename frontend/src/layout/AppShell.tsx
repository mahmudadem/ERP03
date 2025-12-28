import { useState } from 'react';
import { Outlet } from 'react-router-dom'; // Important for nested routing
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { WindowsDesktop } from '../modules/accounting/components/WindowsDesktop';
import { AccountsProvider } from '../context/AccountsContext';
import { useVoucherActions } from '../hooks/useVoucherActions';
import { clsx } from 'clsx';

export const AppShell: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { uiMode } = useUserPreferences();
  const { handleSaveVoucher, handleSubmitVoucher } = useVoucherActions();

  const isWindowsMode = uiMode === 'windows';

  return (
    <div className="min-h-screen flex bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onNavigate={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div 
        className={clsx(
          "flex-1 flex flex-col h-screen transition-all duration-300",
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}
      >
        <TopBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="flex-1 relative overflow-hidden bg-[rgba(var(--color-bg-tertiary-rgb),0.5)]">
          <div className="h-full overflow-y-auto p-4 md:p-6 custom-scroll">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Windows Desktop for MDI Mode */}
      {isWindowsMode && (
        <AccountsProvider>
          <WindowsDesktop 
            onSaveVoucher={handleSaveVoucher} 
            onSubmitVoucher={handleSubmitVoucher}
          />
        </AccountsProvider>
      )}
    </div>
  );
};