import React, { useState } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { WindowsDesktop } from '../modules/accounting/components/WindowsDesktop';
import { AccountsProvider } from '../context/AccountsContext';
import { CostCentersProvider } from '../context/CostCentersContext';
import { useVoucherActions } from '../hooks/useVoucherActions';
import { useDocumentActions } from '../hooks/useDocumentActions';
import { clsx } from 'clsx';
import { PageTitleManager } from '../components/common/PageTitleManager';
import { accountingApi } from '../api/accountingApi';
import { VoucherPrintView } from '../modules/accounting/components/VoucherPrintView';
import { useTranslation } from 'react-i18next';
import { GlobalAiWidget } from '../modules/ai-assistant/components/GlobalAiWidget';

const DESKTOP_SIDEBAR_WIDTH = {
  collapsed: '6rem',
  expanded: '16rem',
} as const;

export const AppShell: React.FC = () => {
  const { uiMode, sidebarPinned } = useUserPreferences();
  const [isSidebarOpen, setIsSidebarOpen] = useState(sidebarPinned);
  const { handleSaveVoucher, handleSubmitVoucher, handleApproveVoucher, handleRejectVoucher, handleConfirmVoucher, post, cancel, reverse } = useVoucherActions();
  const documentActions = useDocumentActions();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const isDesktop = useBreakpoint('lg');

  // Printing State
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<any>(null);
  const [viewingFormType, setViewingFormType] = useState<any>(null);

  const isWindowsMode = uiMode === 'windows';

  // Sync sidebar state with pinned preference and breakpoint
  React.useEffect(() => {
    if (sidebarPinned && isDesktop) {
      setIsSidebarOpen(true);
    }
    if (!isDesktop) {
      // Always close sidebar when on mobile — it hides off-screen via transform
      setIsSidebarOpen(false);
    }
  }, [sidebarPinned, isDesktop]);

  const handleGlobalPrint = (idOrVoucher: string | any, formType?: any) => {
    if (typeof idOrVoucher === 'string') {
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
        try {
          const fullVoucher = await accountingApi.getVoucher(id);
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

  const desktopSidebarWidth = isSidebarOpen
    ? DESKTOP_SIDEBAR_WIDTH.expanded
    : DESKTOP_SIDEBAR_WIDTH.collapsed;

  const shellStyle = {
    '--app-sidebar-width': desktopSidebarWidth,
  } as React.CSSProperties;

  // Sidebar is fixed, so desktop content needs an offset. Keep the offset tied
  // to the same CSS variable used by the sidebar width.
  const desktopMarginStyle = isDesktop
    ? (isRtl
        ? { marginRight: 'var(--app-sidebar-width)', marginLeft: 0 }
        : { marginLeft: 'var(--app-sidebar-width)', marginRight: 0 })
    : undefined; // mobile: sidebar is off-screen, content is full width

  return (
    <AccountsProvider>
      <CostCentersProvider>
        <div
          className="min-h-screen flex bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-sans overflow-hidden"
          style={shellStyle}
        >
          <PageTitleManager />

          {/* Sidebar — slides off-screen on mobile, collapses to icon strip on desktop */}
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            onNavigate={() => {
              if (!sidebarPinned && !isDesktop) {
                setIsSidebarOpen(false);
              }
            }}
          />

          {/* Mobile backdrop — closes sidebar when tapped */}
          {!isDesktop && isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Main Content Area */}
          <div
            className={clsx(
              'flex-1 flex flex-col h-screen transition-all duration-300 print:!ml-0 print:!mr-0 print:!h-auto'
            )}
            style={desktopMarginStyle}
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
              onSalesAction={documentActions.sales}
              onPurchasesAction={documentActions.purchases}
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
          {/* Global AI Assistant Widget */}
          <GlobalAiWidget />
        </div>
      </CostCentersProvider>
    </AccountsProvider>
  );
};
