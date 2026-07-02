import React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from '../ui/Spinner';

interface ModuleSetupWizardShellProps {
  steps: readonly string[];
  currentStep: number;
  children: React.ReactNode;
  error?: string | null;
  loading?: boolean;
  submitting?: boolean;
  backLabel: string;
  nextLabel: string;
  completeLabel: string;
  submittingLabel: string;
  loadingLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
}

export const ModuleSetupWizardShell: React.FC<ModuleSetupWizardShellProps> = ({
  steps,
  currentStep,
  children,
  error,
  loading = false,
  submitting = false,
  backLabel,
  nextLabel,
  completeLabel,
  submittingLabel,
  loadingLabel,
  onBack,
  onNext,
  onComplete,
}) => {
  const isLastStep = currentStep === steps.length - 1;
  const currentTitle = steps[currentStep] ?? '';
  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-3 sm:p-4">
      <section
        className="flex h-[calc(100dvh-1.5rem)] min-h-[36rem] max-h-[750px] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg sm:h-[calc(100dvh-2rem)]"
        aria-label={currentTitle}
      >
        <header className="flex-shrink-0 bg-primary-600 px-4 pb-4 pt-5 sm:px-8 sm:pt-6">
          <div className="flex items-center gap-2" aria-hidden="true">
            {steps.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <React.Fragment key={`${step}-${index}`}>
                  <span
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full transition-colors duration-200 ${
                      isCompleted
                        ? 'bg-white'
                        : isCurrent
                          ? 'bg-white ring-2 ring-white/50'
                          : 'bg-white/30'
                    }`}
                  />
                  {index < steps.length - 1 ? (
                    <span
                      className={`h-0.5 flex-1 transition-colors duration-200 ${
                        index < currentStep ? 'bg-white' : 'bg-white/30'
                      }`}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-4 text-xs text-white">
            <span className="font-medium text-white/90">
              {currentStep + 1} / {steps.length}
            </span>
            <span className="truncate font-semibold">{currentTitle}</span>
            <span className="sr-only">{progressPercent}%</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          {loading ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center">
              <Spinner size="lg" />
              {loadingLabel ? <p className="text-sm text-gray-600">{loadingLabel}</p> : null}
            </div>
          ) : (
            children
          )}
        </div>

        {error ? (
          <div className="flex-shrink-0 px-4 pb-3 sm:px-8 sm:pb-4">
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          </div>
        ) : null}

        <footer className="flex flex-shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={onBack}
            disabled={currentStep === 0 || submitting}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {backLabel}
          </button>

          <button
            type="button"
            onClick={isLastStep ? onComplete : onNext}
            disabled={submitting || loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
          >
            {isLastStep && submitting ? (
              <>
                <Spinner size="sm" />
                {submittingLabel}
              </>
            ) : (
              <>
                {isLastStep ? completeLabel : nextLabel}
                {isLastStep ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                )}
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
};
