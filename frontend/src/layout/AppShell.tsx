import React, { useState } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Outlet, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const isApexMockupPath = location.pathname.startsWith('/dev/apex-ledger');
  const { uiMode, sidebarPinned, sidebarMode, layoutMode } = useUserPreferences();

  if (isApexMockupPath) {
    return (
      <AccountsProvider>
        <CostCentersProvider>
          <div className="h-screen w-screen bg-[#FAFAFB] overflow-hidden">
            <Outlet />
          </div>
        </CostCentersProvider>
      </AccountsProvider>
    );
  }

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
  const isAccordionMode = sidebarMode === 'submenus';

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

  const shellStyle = {
    '--app-sidebar-width': '16rem',
  } as React.CSSProperties;

  // Determine desktop margin (offset) for main content area
  let desktopMarginStyle: React.CSSProperties | undefined = undefined;

  if (isDesktop) {
    if (isAccordionMode) {
      // Accordion mode: shifts content only when open AND pinned
      if (isSidebarOpen && sidebarPinned) {
        desktopMarginStyle = isRtl
          ? { marginRight: '16rem', marginLeft: 0 }
          : { marginLeft: '16rem', marginRight: 0 };
      }
    } else {
      // Flat mode: shifts content by 16rem if open, and by 6rem if closed
      const currentWidth = isSidebarOpen ? '16rem' : '6rem';
      desktopMarginStyle = isRtl
        ? { marginRight: currentWidth, marginLeft: 0 }
        : { marginLeft: currentWidth, marginRight: 0 };
    }
  }

  return (
    <AccountsProvider>
      <CostCentersProvider>
        <div
          data-layout={layoutMode}
          className="app-shell-container h-screen flex flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans overflow-hidden"
        >
          <PageTitleManager />

          {/* TopBar spans 100% width of the viewport */}
          <TopBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

          {/* Main workspace area below TopBar */}
          <div className="flex-1 flex relative overflow-hidden" style={shellStyle}>
            {/* Sidebar — floats on top or docks below TopBar */}
            <Sidebar
              isOpen={isSidebarOpen}
              onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
              onNavigate={() => {
                if (!sidebarPinned && !isDesktop) {
                  setIsSidebarOpen(false);
                }
              }}
            />

            {/* Backdrop — active when sidebar is open and in overlay mode (not pinned accordion on desktop, or mobile) */}
            {isSidebarOpen && (!isDesktop || (isAccordionMode && !sidebarPinned)) && (
              <div
                className="fixed inset-0 bg-black/30 z-30"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Main Content Area */}
            <div
              className={clsx(
                'flex-1 flex flex-col transition-all duration-300 print:!ml-0 print:!mr-0'
              )}
              style={desktopMarginStyle}
            >
              <main className="app-main-content flex-1 relative overflow-hidden bg-[rgba(var(--color-bg-tertiary-rgb),0.5)] print:!overflow-visible print:!static">
                <div className="h-full overflow-y-auto custom-scroll print:!h-auto print:!overflow-visible page-container">
                  <Outlet />
                </div>
              </main>
            </div>
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
