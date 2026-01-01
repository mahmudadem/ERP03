/**
 * Windows Desktop Component
 * 
 * MDI container that renders all open voucher windows and the taskbar.
 * Provides the full Windows desktop experience.
 */

import React from 'react';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { VoucherWindow } from './VoucherWindow';
import { VoucherTaskbar } from './VoucherTaskbar';

interface WindowsDesktopProps {
  onSaveVoucher: (windowId: string, data: any) => Promise<void>;
  onSubmitVoucher: (windowId: string, data: any) => Promise<void>;
  onApproveVoucher?: (windowId: string, id: string) => Promise<void>;
  onRejectVoucher?: (windowId: string, id: string) => Promise<void>;
}

export const WindowsDesktop: React.FC<WindowsDesktopProps> = ({ 
  onSaveVoucher, 
  onSubmitVoucher,
  onApproveVoucher,
  onRejectVoucher
}) => {
  const { windows } = useWindowManager();

  return (
    <>
      {/* Render all windows */}
      {windows.map((window) => (
        <VoucherWindow
          key={window.id}
          win={window}
          onSave={onSaveVoucher}
          onSubmit={onSubmitVoucher}
          onApprove={onApproveVoucher ? (id) => onApproveVoucher(window.id, id) : undefined}
          onReject={onRejectVoucher ? (id) => onRejectVoucher(window.id, id) : undefined}
        />
      ))}

      {/* Taskbar at bottom */}
      <VoucherTaskbar />
    </>
  );
};
