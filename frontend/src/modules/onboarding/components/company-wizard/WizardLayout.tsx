
import React from 'react';
import { WizardStep } from './types';
import { Check } from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface WizardLayoutProps {
  currentStep: WizardStep;
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const steps = [
  { id: WizardStep.BasicInfo, label: 'Basic Info' },
  { id: WizardStep.BundleSelection, label: 'Select Bundle' },
  { id: WizardStep.ContactInfo, label: 'Contact Info' },
  { id: WizardStep.Review, label: 'Review' },
];

export const WizardLayout: React.FC<WizardLayoutProps> = ({ 
  currentStep, 
  children,
  title,
  subtitle
}) => {
  const isComplete = currentStep === WizardStep.Success;

  return (
    <div className="w-full h-full bg-[var(--color-bg-primary)] flex flex-col overflow-hidden transition-colors">
      
      {/* Header Area: Fixed height, shrinks if needed */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 py-4 md:px-8 md:py-5 flex-shrink-0 transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">{title}</h2>
                {/* Hide subtitle on very small screens to save space */}
                <p className="text-sm md:text-base text-[var(--color-text-secondary)] mt-1 hidden xs:block">{subtitle}</p>
            </div>
        </div>
        
        {/* Stepper */}
        {!isComplete && (
          <div className="mt-6 mx-auto max-w-3xl w-full">
            <nav aria-label="Progress">
              <ol role="list" className="flex items-center w-full">
                {steps.map((step, stepIdx) => {
                  const isActive = step.id === currentStep;
                  const isCompleted = step.id < currentStep;
                  const isLastStep = stepIdx === steps.length - 1;

                  return (
                    <li key={step.id} className={cn("relative flex flex-col items-center flex-1")}>
                      {/* Line connector */}
                      {!isLastStep && (
                        <div className="absolute top-3.5 left-[50%] right-[-50%] h-[2px] bg-[var(--color-border)] z-0">
                          <div 
                            className={cn(
                              "h-full bg-primary-600 transition-all duration-300 ease-in-out",
                              isCompleted ? "w-full" : "w-0"
                            )} 
                          />
                        </div>
                      )}
                      
                      {/* Circle Indicator */}
                      <div className={cn(
                        "relative z-10 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full border-2 transition-colors duration-300 bg-[var(--color-bg-primary)]",
                        isCompleted ? "border-primary-600 bg-primary-600" : 
                        isActive ? "border-primary-600" : "border-[var(--color-border)]"
                      )}>
                        {isCompleted ? (
                          <Check className="h-4 w-4 md:h-5 md:w-5 text-white" aria-hidden="true" />
                        ) : (
                          <span className={cn(
                            "h-2 w-2 md:h-2.5 md:w-2.5 rounded-full transition-colors duration-300",
                            isActive ? "bg-primary-600" : "bg-transparent"
                          )} />
                        )}
                      </div>
                      
                      {/* Label */}
                      <span className={cn(
                        "mt-2 text-[10px] md:text-sm font-bold transition-colors duration-300 text-center uppercase tracking-widest",
                        isActive || isCompleted ? "text-primary-600" : "text-[var(--color-text-muted)]"
                      )}>
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        )}
      </div>

      {/* Content Area: Expands to fill remaining height */}
      <div className="flex-1 bg-[var(--color-bg-primary)] p-4 md:p-6 overflow-hidden flex flex-col min-h-0 relative transition-colors">
        {children}
      </div>
    </div>
  );
};
