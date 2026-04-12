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
  onPrintVoucher
}) => {
  const { windows } = useWindowManager();

  return (
    <>
      {/* Render all windows */}
      {windows.map((window) => {
        if (window.type === 'voucher') {
          return (
            <VoucherWindow
              key={window.id}
              win={window}
              onSave={onSaveVoucher}
              onSubmit={onSubmitVoucher}
              onApprove={onApproveVoucher ? (id) => onApproveVoucher(window.id, id) : undefined}
              onReject={onRejectVoucher ? (id) => onRejectVoucher(window.id, id) : undefined}
              onConfirm={onConfirmVoucher ? (id) => onConfirmVoucher(window.id, id) : undefined}
              onPost={onPostVoucher}
              onCancel={onCancelVoucher}
              onReverse={onReverseVoucher}
              onPrint={onPrintVoucher}
            />
          );
        } else if (window.type === 'report') {
          return (
            <ReportWindow 
              key={window.id}
              win={window}
            />
          );
        } else if (window.type === 'item') {
          return (
            <ItemCardWindow
              key={window.id}
              win={window}
            />
          );
        } else if (window.type === 'party') {
          return (
            <PartyCardWindow
              key={window.id}
              win={window}
            />
          );
        } else if (window.type === 'warehouse') {
          return (
            <WarehouseCardWindow
              key={window.id}
              win={window}
            />
          );
        }
        return null;
      })}

      {/* Taskbar at bottom */}
      <VoucherTaskbar />
    </>
  );
};
