import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { voucherTypeRepository } from '../repositories/VoucherTypeRepository';

export type DesignerStep = 'TYPE' | 'BASIC' | 'FIELDS' | 'CUSTOM' | 'JOURNAL' | 'LAYOUT' | 'REVIEW';

export const STEPS: { id: DesignerStep; label: string }[] = [
  { id: 'TYPE', label: 'Select Type' },
  { id: 'BASIC', label: 'Basic Info' },
  { id: 'FIELDS', label: 'Standard Fields' },
  { id: 'CUSTOM', label: 'Custom Fields' },
  { id: 'JOURNAL', label: 'Journal Config' },
  { id: 'LAYOUT', label: 'Visual Layout' },
  { id: 'REVIEW', label: 'Review' }
];

export const useVoucherDesigner = (initialCode?: string) => {
  const [currentStep, setCurrentStep] = useState<DesignerStep>('TYPE');
  const [definition, setDefinition] = useState<Partial<VoucherTypeDefinition>>({
    headerFields: [],
    tableFields: [],
    customFields: [],
    layout: { sections: [] }
  });
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
      const payload = { ...definition, status: 'ACTIVE' } as VoucherTypeDefinition;
      
      if (initialCode) {
        await voucherTypeRepository.update(initialCode, payload);
      } else {
        await voucherTypeRepository.create(payload);
      }
      
      // Close or notify
      if (window.confirm('Voucher Type saved and activated! Do you want to close the designer?')) {
         // This assumes the parent component handles close, but we can't trigger it from here directly 
         // without the prop. The wizard calls onClose on success ideally but useVoucherDesigner 
         // doesn't have access to onClose.
         // We will just alert for now.
      }
    } catch (err: any) {
      setError(err.message);
      alert('Failed to save: ' + err.message);
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
