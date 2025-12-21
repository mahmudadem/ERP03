import React, { createContext, useContext, useState, useEffect } from 'react';
import { VoucherTypeConfig } from './types';

interface VoucherContextType {
  vouchers: VoucherTypeConfig[];
  addVoucher: (voucher: VoucherTypeConfig) => void;
  updateVoucher: (voucher: VoucherTypeConfig) => void;
  deleteVoucher: (id: string) => void;
  getVoucher: (id: string) => VoucherTypeConfig | undefined;
}

const VoucherContext = createContext<VoucherContextType | undefined>(undefined);

// Initial System Vouchers
const SYSTEM_VOUCHERS: VoucherTypeConfig[] = [
  {
    id: 'journal_voucher',
    name: 'Journal Voucher',
    prefix: 'JV-',
    startNumber: 1000,
    rules: [],
    isMultiLine: true,
    actions: [],
    uiModeOverrides: { classic: { sections: {} }, windows: { sections: {} } }
  },
  {
    id: 'payment_voucher',
    name: 'Payment Voucher',
    prefix: 'PV-',
    startNumber: 2000,
    rules: [],
    isMultiLine: true,
    actions: [],
    uiModeOverrides: { classic: { sections: {} }, windows: { sections: {} } }
  },
   {
    id: 'receipt_voucher',
    name: 'Receipt Voucher',
    prefix: 'RV-',
    startNumber: 3000,
    rules: [],
    isMultiLine: true,
    actions: [],
    uiModeOverrides: { classic: { sections: {} }, windows: { sections: {} } }
  }
];

export const VoucherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vouchers, setVouchers] = useState<VoucherTypeConfig[]>(() => {
    // Load from local storage or use defaults
    const saved = localStorage.getItem('cloudERP_vouchers');
    return saved ? JSON.parse(saved) : SYSTEM_VOUCHERS;
  });

  useEffect(() => {
    localStorage.setItem('cloudERP_vouchers', JSON.stringify(vouchers));
  }, [vouchers]);

  const addVoucher = (voucher: VoucherTypeConfig) => {
    setVouchers(prev => [...prev, voucher]);
  };

  const updateVoucher = (voucher: VoucherTypeConfig) => {
    setVouchers(prev => prev.map(v => v.id === voucher.id ? voucher : v));
  };

  const deleteVoucher = (id: string) => {
    setVouchers(prev => prev.filter(v => v.id !== id));
  };

  const getVoucher = (id: string) => {
    return vouchers.find(v => v.id === id);
  };

  return (
    <VoucherContext.Provider value={{ vouchers, addVoucher, updateVoucher, deleteVoucher, getVoucher }}>
      {children}
    </VoucherContext.Provider>
  );
};

export const useVouchers = () => {
  const context = useContext(VoucherContext);
  if (!context) {
    throw new Error('useVouchers must be used within a VoucherProvider');
  }
  return context;
};