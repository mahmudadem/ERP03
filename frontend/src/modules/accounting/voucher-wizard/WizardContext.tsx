/**
 * Voucher Wizard Context
 * 
 * ⚠️ STRICTLY UI STATE ONLY
 * - Does NOT persist to database
 * - Does NOT call APIs
 * - Does NOT transform to schemas
 * - Uses localStorage for demo/temporary storage only
 * 
 * Actual persistence happens OUTSIDE the wizard via onFinish callback.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VoucherTypeConfig } from './types';

interface WizardContextType {
  vouchers: VoucherTypeConfig[];
  addVoucher: (voucher: VoucherTypeConfig) => void;
  updateVoucher: (voucher: VoucherTypeConfig) => void;
  deleteVoucher: (id: string) => void;
  getVoucher: (id: string) => VoucherTypeConfig | undefined;
  setVouchers: (vouchers: VoucherTypeConfig[]) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

interface WizardProviderProps {
  children: ReactNode;
  initialVouchers?: VoucherTypeConfig[];
}

export const WizardProvider: React.FC<WizardProviderProps> = ({ children, initialVouchers = [] }) => {
  const [vouchers, setVouchers] = useState<VoucherTypeConfig[]>(initialVouchers);

  // Update vouchers when initialVouchers prop changes
  useEffect(() => {
    if (initialVouchers &&  initialVouchers.length > 0) {
      setVouchers(initialVouchers);
    }
  }, [initialVouchers]);

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
    <WizardContext.Provider value={{ vouchers, addVoucher, updateVoucher, deleteVoucher, getVoucher, setVouchers }}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};
