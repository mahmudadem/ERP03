import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { voucherTypeRepository } from '../repositories/VoucherTypeRepository';
import { errorHandler } from '../../../../services/errorHandler';

export type DesignerStep = 'TYPE' | 'BASIC' | 'FIELDS' | 'JOURNAL' | 'LAYOUT' | 'REVIEW';

export const STEPS: { id: DesignerStep; label: string }[] = [
  { id: 'TYPE', label: 'Select Type' },
  { id: 'BASIC', label: 'Basic Info' },
  { id: 'FIELDS', label: 'Standard Fields' },
  { id: 'JOURNAL', label: 'Journal Config' },
  { id: 'LAYOUT', label: 'Visual Layout' },
  { id: 'REVIEW', label: 'Review' }
];

const getDefaultDefinition = (code?: string): Partial<VoucherTypeDefinition> => ({
  id: '',
  companyId: '',
  name: '',
  code: code || '',
  module: 'ACCOUNTING',
  headerFields: [],
  tableColumns: [], // Canonical Schema V2
  layout: {},
  schemaVersion: 2, // Required Schema V2
  workflow: {}
});

export const useVoucherDesigner = (initialCode?: string) => {
  const [currentStep, setCurrentStep] = useState<DesignerStep>('TYPE');
  const [definition, setDefinition] = useState<Partial<VoucherTypeDefinition>>(getDefaultDefinition());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      loadDefinition(initialCode);
    }
  }, [initialCode]);

  const loadDefinition = async (code: string) => {
    setLoading(true);
    try {
      const def = await voucherTypeRepository.get(code);
      setDefinition(def);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateDefinition = (updates: Partial<VoucherTypeDefinition>) => {
    setDefinition(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      const payload = definition as VoucherTypeDefinition;
      
      if (initialCode) {
        await voucherTypeRepository.update(initialCode, payload);
      } else {
        await voucherTypeRepository.create(payload);
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      errorHandler.showError(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentStep,
    setCurrentStep,
    definition,
    updateDefinition,
    loading,
    error,
    nextStep,
    prevStep,
    save,
    steps: STEPS
  };
};
