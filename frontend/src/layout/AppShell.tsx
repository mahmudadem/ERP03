import { useState } from 'react';
import { Outlet } from 'react-router-dom'; // Important for nested routing
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { WindowsDesktop } from '../modules/accounting/components/WindowsDesktop';
import { AccountsProvider } from '../context/AccountsContext';
import { CostCentersProvider } from '../context/CostCentersContext';
import { useVoucherActions } from '../hooks/useVoucherActions';
import { clsx } from 'clsx';
import React from 'react'; // Added React import for React.useEffect
import { PageTitleManager } from '../components/common/PageTitleManager';
import { accountingApi } from '../api/accountingApi';
import { VoucherPrintView } from '../modules/accounting/components/VoucherPrintView';
import { useTranslation } from 'react-i18next';

export const AppShell: React.FC = () => {
  const { uiMode, sidebarPinned } = useUserPreferences();
  const [isSidebarOpen, setIsSidebarOpen] = useState(sidebarPinned);
  const { handleSaveVoucher, handleSubmitVoucher, handleApproveVoucher, handleRejectVoucher, handleConfirmVoucher, post, cancel, reverse } = useVoucherActions();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [isDesktop, setIsDesktop] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  React.useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  
  // Printing State (Moved to Shell for global access)
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<any>(null);
  const [viewingFormType, setViewingFormType] = useState<any>(null);

  const isWindowsMode = uiMode === 'windows';

  // Sync isSidebarOpen with sidebarPinned if pinned is enabled
  React.useEffect(() => {
    if (sidebarPinned) {
      setIsSidebarOpen(true);
    }
  }, [sidebarPinned]);

  const handleGlobalPrint = (idOrVoucher: string | any, formType?: any) => {
    if (typeof idOrVoucher === 'string') {
      // If only ID is passed, we might need a separate mechanism to fetch, 
      // but for now we expect the caller to pass the object or we use a global bus.
      // Actually, let's support dispatching an event that VouchersListPage (which has the data) or a service can hear.
      window.dispatchEvent(new CustomEvent('request-print-voucher', { detail: { id: idOrVoucher } }));
    } else {
      setViewingVoucher(idOrVoucher);
      setViewingFormType(formType);
      setIsPrintViewOpen(true);
    }
  };

  // Listen for print requests
  React.useEffect(() => {
     const handler = async (e: any) => {
        const { id, voucher, formType } = e.detail;
        if (voucher) {
           setViewingVoucher(voucher);
           setViewingFormType(formType);
           setIsPrintViewOpen(true);
        } else if (id) {
           // Fetch and print
           try {
              const fullVoucher = await accountingApi.getVoucher(id);
              // We'll need the form type. We can try to infer it or just pass it in detail.
              setViewingVoucher(fullVoucher);
              setViewingFormType(formType); 
              setIsPrintViewOpen(true);
           } catch (err) {
              console.error('Failed to fetch voucher for global print:', err);
           }
        }
     };
     window.addEventListener('print-voucher', handler as any);
     return () => window.removeEventListener('print-voucher', handler as any);
  }, []);

  return (
    <AccountsProvider>
      <CostCentersProvider>
      <div className="min-h-screen flex bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-sans overflow-hidden">
        <PageTitleManager />
        {/* Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigate={() => {
            if (!sidebarPinned && window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
        />

        {/* Main Content Area */}
        <div 
          className={clsx(
            "flex-1 flex flex-col h-screen transition-all duration-300 print:!ml-0 print:!mr-0 print:!h-auto"
          )}
          style={
            isDesktop
              ? (isRtl 
                ? { marginRight: isSidebarOpen ? '14.4rem' : '4.5rem', marginLeft: 0 } 
                : { marginLeft: isSidebarOpen ? '14.4rem' : '4.5rem', marginRight: 0 })
              : undefined
          }
        >
          <TopBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

          <main className="flex-1 relative overflow-hidden bg-[rgba(var(--color-bg-tertiary-rgb),0.5)] print:!overflow-visible print:!static">
            <div className="h-full overflow-y-auto custom-scroll print:!h-auto print:!overflow-visible">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Global Windows Desktop for MDI Mode */}
        {isWindowsMode && (
          <WindowsDesktop 
            onSaveVoucher={handleSaveVoucher} 
            onSubmitVoucher={handleSubmitVoucher}
            onApproveVoucher={handleApproveVoucher}
            onRejectVoucher={handleRejectVoucher}
            onConfirmVoucher={handleConfirmVoucher}
            onPostVoucher={post}
            onCancelVoucher={cancel}
            onReverseVoucher={reverse}
            onPrintVoucher={(id) => {
               window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id } }));
            }}
          />
        )}

        {/* Global Print View */}
        {isPrintViewOpen && viewingVoucher && (
          <VoucherPrintView 
            voucher={viewingVoucher}
            voucherType={viewingFormType}
            onClose={() => setIsPrintViewOpen(false)}
          />
        )}
      </div>
      </CostCentersProvider>
    </AccountsProvider>
  );
};
