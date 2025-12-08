import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { voucherTypeRepository } from '../repositories/VoucherTypeRepository';

export type DesignerStep = 'BASIC' | 'RULES' | 'FIELDS' | 'JOURNAL' | 'LAYOUT' | 'ACTIONS' | 'REVIEW';

export const STEPS: { id: DesignerStep; label: string }[] = [
  { id: 'BASIC', label: 'Basic Info' },
  { id: 'RULES', label: 'Rules & Approval' },
  { id: 'FIELDS', label: 'Fields Builder' },
  { id: 'JOURNAL', label: 'Journal Config' },
  { id: 'LAYOUT', label: 'Visual Layout' },
  { id: 'ACTIONS', label: 'Actions' },
  { id: 'REVIEW', label: 'Review' }
];

export const useVoucherDesigner = (initialCode?: string) => {
  const [currentStep, setCurrentStep] = useState<DesignerStep>('BASIC');
  const [definition, setDefinition] = useState<Partial<VoucherTypeDefinition>>({
    headerFields: [],
    tableColumns: [],
    layout: { sections: [] },
    workflow: { approvalRequired: false }
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
      if (initialCode) {
        await voucherTypeRepository.update(initialCode, definition as VoucherTypeDefinition);
      } else {
        await voucherTypeRepository.create(definition as VoucherTypeDefinition);
      }
      alert('Saved successfully!');
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
