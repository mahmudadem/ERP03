/**
 * Windows Desktop Component
 * 
 * MDI container that renders all open voucher windows and the taskbar.
 * Provides the full Windows desktop experience.
 */

import React from 'react';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { VoucherWindow } from './VoucherWindow';
import { ReportWindow } from './ReportWindow';
import { VoucherTaskbar } from './VoucherTaskbar';
import { ItemCardWindow } from '../../inventory/components/ItemCardWindow';
import { PartyCardWindow } from './PartyCardWindow';
import { WarehouseCardWindow } from './WarehouseCardWindow';
import { DocumentWindow } from '../../../components/mdi/DocumentWindow';
import { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';
import { SalesInvoiceDetail } from '../../sales/pages/SalesInvoiceDetailPage';

interface WindowsDesktopProps {
  onSaveVoucher: (windowId: string, data: any) => Promise<any>;
  onSubmitVoucher: (windowId: string, data: any) => Promise<any>;
  onApproveVoucher?: (windowId: string, id: string) => Promise<void>;
  onRejectVoucher?: (windowId: string, id: string) => Promise<void>;
  onConfirmVoucher?: (windowId: string, id: string) => Promise<void>;
  onPostVoucher?: (id: string) => Promise<void>;
  onCancelVoucher?: (id: string) => Promise<void>;
  onReverseVoucher?: (id: string) => Promise<void>;
  onPrintVoucher?: (id: string) => void;
  // Document Actions
  onSalesAction?: any;
  onPurchasesAction?: any;
}

export const WindowsDesktop: React.FC<WindowsDesktopProps> = ({ 
  onSaveVoucher, 
  onSubmitVoucher,
  onApproveVoucher,
  onRejectVoucher,
  onConfirmVoucher,
  onPostVoucher,
  onCancelVoucher,
  onReverseVoucher,
  onPrintVoucher,
  onSalesAction,
  onPurchasesAction
}) => {
  const { windows, closeWindow } = useWindowManager();

  return (
    <>
      {/* Render all windows */}
      {windows.map((win) => {
        if (win.type === 'voucher') {
          return (
            <VoucherWindow
              key={win.id}
              win={win}
              onSave={onSaveVoucher}
              onSubmit={onSubmitVoucher}
              onApprove={onApproveVoucher ? (id) => onApproveVoucher(win.id, id) : undefined}
              onReject={onRejectVoucher ? (id) => onRejectVoucher(win.id, id) : undefined}
              onConfirm={onConfirmVoucher ? (id) => onConfirmVoucher(win.id, id) : undefined}
              onPost={onPostVoucher}
              onCancel={onCancelVoucher}
              onReverse={onReverseVoucher}
              onPrint={onPrintVoucher}
            />
          );
        } else if (win.type === 'report') {
          return (
            <ReportWindow 
              key={win.id}
              win={win}
            />
          );
        } else if (win.type === 'item') {
          return (
            <ItemCardWindow
              key={win.id}
              win={win}
            />
          );
        } else if (win.type === 'party') {
          return (
            <PartyCardWindow
              key={win.id}
              win={win}
            />
          );
        } else if (win.type === 'warehouse') {
          return (
            <WarehouseCardWindow
              key={win.id}
              win={win}
            />
          );
        } else if (win.type === 'document') {
          return (
            <DocumentWindow
              key={win.id}
              win={win}
              onSalesAction={onSalesAction}
              onPurchasesAction={onPurchasesAction}
            />
          );
        } else if (win.type === 'sales_invoice') {
          return (
            <MdiWindowFrame
              key={win.id}
              win={win}
              title={win.title}
              onClose={() => closeWindow(win.id)}
            >
              <SalesInvoiceDetail
                invoiceId={win.data?.invoiceId}
                isWindow={true}
                onClose={() => closeWindow(win.id)}
                onSaved={() => {
                  closeWindow(win.id);
                  window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: 'SI' } }));
                }}
              />
            </MdiWindowFrame>
          );
        }
        return null;
      })}

      {/* Taskbar at bottom */}
      <VoucherTaskbar />
    </>
  );
};
