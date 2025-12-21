/**
 * Window Manager Context
 * 
 * Manages multiple open voucher windows in MDI (Multiple Document Interface) style.
 * Allows users to open, minimize, maximize, and switch between multiple vouchers.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { VoucherTypeConfig } from '../modules/accounting/voucher-wizard/types';

export interface VoucherWindow {
  id: string;
  voucherType: VoucherTypeConfig;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any; // Voucher data being edited
}

interface WindowManagerContextType {
  windows: VoucherWindow[];
  openWindow: (voucherType: VoucherTypeConfig, data?: any) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  updateWindowData: (id: string, data: any) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<VoucherWindow[]>([]);

  const openWindow = useCallback((voucherType: VoucherTypeConfig, data?: any) => {
    const id = `voucher-${Date.now()}`;
    const newWindow: VoucherWindow = {
      id,
      voucherType,
      title: `New ${voucherType.name}`,
      isMinimized: false,
      isMaximized: false,
      isFocused: true,
      position: { 
        x: 100 + (windows.length * 30), // Cascade effect
        y: 50 + (windows.length * 30) 
      },
      size: { width: 900, height: 600 },
      data
    };

    setWindows(prev => [
      ...prev.map(w => ({ ...w, isFocused: false })), // Unfocus others
      newWindow
    ]);
  }, [windows.length]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: !w.isMinimized } : w
    ));
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
    ));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => ({
      ...w,
      isFocused: w.id === id,
      isMinimized: w.id === id ? false : w.isMinimized // Restore if minimized
    })));
  }, []);

  const updateWindowPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, position } : w
    ));
  }, []);

  const updateWindowSize = useCallback((id: string, size: { width: number; height: number }) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, size } : w
    ));
  }, []);

  const updateWindowData = useCallback((id: string, data: any) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, data } : w
    ));
  }, []);

  return (
    <WindowManagerContext.Provider value={{
      windows,
      openWindow,
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      focusWindow,
      updateWindowPosition,
      updateWindowSize,
      updateWindowData
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
};

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within WindowManagerProvider');
  }
  return context;
};
