import React, { createContext, useContext, useState, useCallback } from 'react';
import { wizardApi, CompanyWizardStep, WizardStepMeta } from '../api';
import { queryClient } from '../../../../queryClient';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';

interface WizardSessionContextValue {
  sessionId: string | null;
  model: string | null;
  stepsMeta: WizardStepMeta[];
  currentStepId: string | null;
  currentStep: CompanyWizardStep | null;
  isLastStep: boolean;
  loading: boolean;
  startWizard: (companyName: string, model: string) => Promise<string>;
  resumeSession: (sessionId: string) => Promise<void>;
  loadCurrentStep: (sessionIdParam?: string) => Promise<void>;
  submitStep: (values: Record<string, any>) => Promise<{ nextStepId?: string; isLastStep: boolean }>;
  completeWizard: () => Promise<{ companyId: string; activeCompanyId: string }>;
}

const WizardSessionContext = createContext<WizardSessionContextValue | undefined>(undefined);

export const WizardSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [stepsMeta, setStepsMeta] = useState<WizardStepMeta[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<CompanyWizardStep | null>(null);
  const [isLastStep, setIsLastStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loadActiveCompany } = useCompanyAccess();

  const computeIsLast = useCallback(
    (stepId: string | null, meta: WizardStepMeta[]) => {
      if (!stepId || meta.length === 0) return false;
      const ordered = [...meta].sort((a, b) => a.order - b.order);
      const idx = ordered.findIndex((s) => s.id === stepId);
      return idx === ordered.length - 1;
    },
    []
  );

  const loadCurrentStep = useCallback(
    async (sessionIdParam?: string, metaOverride?: WizardStepMeta[]) => {
      const sid = sessionIdParam || sessionId;
      if (!sid) return;
      setLoading(true);
      try {
        const step = await wizardApi.getCurrentStep(sid);
        setCurrentStep(step);
        setCurrentStepId(step.id);
        const meta = metaOverride && metaOverride.length ? metaOverride : stepsMeta;
        if (!meta.length && step) {
          // Seed metadata but do not assume this is the last step when we only know about one step
          const seeded = [{ id: step.id, titleEn: step.titleEn, titleAr: step.titleAr, titleTr: step.titleTr, order: step.order }];
          setStepsMeta(seeded);
          setIsLastStep(false);
        } else {
          setIsLastStep(meta.length > 1 ? computeIsLast(step.id, meta) : false);
        }
      } finally {
        setLoading(false);
      }
    },
    [sessionId, stepsMeta, computeIsLast]
  );

  const startWizard = useCallback(
    async (companyName: string, modelKey: string) => {
      setLoading(true);
      try {
        const result = await wizardApi.startWizard({ companyName, model: modelKey });
        if (!result?.sessionId) {
          throw new Error('Failed to start wizard session');
        }
        // Normalize metadata: prefer full steps list for the selected model
        const stepsForModel = await wizardApi.getStepsForModel(modelKey).catch(() => result.stepsMeta || []);
        const meta = stepsForModel && stepsForModel.length
          ? stepsForModel.map((s) => ({ id: s.id, titleEn: s.titleEn, titleAr: s.titleAr, titleTr: s.titleTr, order: s.order }))
          : (result.stepsMeta || []);

        setSessionId(result.sessionId);
        setModel(result.model);
        setStepsMeta(meta);
        setCurrentStepId(result.currentStepId);
        setIsLastStep(meta.length > 1 ? computeIsLast(result.currentStepId, meta) : false);
        await loadCurrentStep(result.sessionId, meta);
        return result.sessionId;
      } finally {
        setLoading(false);
      }
    },
    [computeIsLast, loadCurrentStep]
  );

  const resumeSession = useCallback(
    async (sid: string) => {
      setSessionId(sid);
      setLoading(true);
      try {
        await loadCurrentStep(sid);
      } finally {
        setLoading(false);
      }
    },
    [loadCurrentStep]
  );

  const submitStep = useCallback(
    async (values: Record<string, any>) => {
      if (!sessionId || !currentStepId) throw new Error('No active wizard session');
      setLoading(true);
      try {
        const result = await wizardApi.submitStep({ sessionId, stepId: currentStepId, values });
        setIsLastStep(result.isLastStep);
        if (result.nextStepId) {
          setCurrentStepId(result.nextStepId);
          await loadCurrentStep(sessionId);
        } else {
          // Stay on the same step; allow finish to proceed
          setCurrentStepId(currentStepId);
        }
        return result;
      } finally {
        setLoading(false);
      }
    },
    [currentStepId, loadCurrentStep, sessionId]
  );

  const completeWizard = useCallback(async () => {
    if (!sessionId) throw new Error('No active wizard session');
    setLoading(true);
    try {
      const result = await wizardApi.completeWizard(sessionId);
      await queryClient.clear();
      localStorage.setItem('activeCompanyId', result.activeCompanyId);
      await loadActiveCompany();
      return result;
    } finally {
      setLoading(false);
    }
  }, [loadActiveCompany, sessionId]);

  const value: WizardSessionContextValue = {
    sessionId,
    model,
    stepsMeta,
    currentStepId,
    currentStep,
    isLastStep,
    loading,
    startWizard,
    resumeSession,
    loadCurrentStep,
    submitStep,
    completeWizard,
  };

  return <WizardSessionContext.Provider value={value}>{children}</WizardSessionContext.Provider>;
};

export function useWizardSession() {
  const ctx = useContext(WizardSessionContext);
  if (!ctx) {
    throw new Error('useWizardSession must be used within WizardSessionProvider');
  }
  return ctx;
}
