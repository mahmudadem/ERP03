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
import { VoucherFormConfig } from './types';

interface WizardContextType {
  forms: VoucherFormConfig[];
  addForm: (form: VoucherFormConfig) => void;
  updateForm: (form: VoucherFormConfig) => void;
  deleteForm: (id: string) => void;
  getForm: (id: string) => VoucherFormConfig | undefined;
  setForms: (forms: VoucherFormConfig[]) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

interface WizardProviderProps {
  children: ReactNode;
  initialForms?: VoucherFormConfig[];
}

export const WizardProvider: React.FC<WizardProviderProps> = ({ children, initialForms = [] }) => {
  const [forms, setForms] = useState<VoucherFormConfig[]>(initialForms);

  // Update forms when initialForms prop changes
  useEffect(() => {
    if (initialForms && initialForms.length > 0) {
      setForms(initialForms);
    }
  }, [initialForms]);

  const addForm = (form: VoucherFormConfig) => {
    setForms(prev => [...prev, form]);
  };

  const updateForm = (form: VoucherFormConfig) => {
    setForms(prev => prev.map(v => v.id === form.id ? form : v));
  };

  const deleteForm = (id: string) => {
    setForms(prev => prev.filter(v => v.id !== id));
  };

  const getForm = (id: string) => {
    return forms.find(v => v.id === id);
  };

  return (
    <WizardContext.Provider value={{ forms, addForm, updateForm, deleteForm, getForm, setForms }}>
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
