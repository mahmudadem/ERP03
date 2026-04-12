/**
 * Document Wizard Context
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
import { DocumentFormConfig } from './types';

interface WizardContextType {
  forms: DocumentFormConfig[];
  addForm: (form: DocumentFormConfig) => void;
  updateForm: (form: DocumentFormConfig) => void;
  deleteForm: (id: string) => void;
  getForm: (id: string) => DocumentFormConfig | undefined;
  setForms: (forms: DocumentFormConfig[]) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

interface WizardProviderProps {
  children: ReactNode;
  initialForms?: DocumentFormConfig[];
}

export const WizardProvider: React.FC<WizardProviderProps> = ({ children, initialForms = [] }) => {
  const [forms, setForms] = useState<DocumentFormConfig[]>(initialForms);

  // Update forms when initialForms prop changes
  useEffect(() => {
    setForms(initialForms);
  }, [initialForms]);

  const addForm = (form: DocumentFormConfig) => {
    setForms(prev => [...prev, form]);
  };

  const updateForm = (form: DocumentFormConfig) => {
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
