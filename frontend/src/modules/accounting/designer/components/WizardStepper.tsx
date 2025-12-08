import React from 'react';
import { STEPS } from '../hooks/useVoucherDesigner';

interface Props {
  currentStep: string;
  onStepClick: (stepId: string) => void;
}

export const WizardStepper: React.FC<Props> = ({ currentStep, onStepClick }) => {
  return (
    <div className="w-full py-8 px-12">
      <div className="flex justify-between items-center relative">
        {/* Progress Bar Background */}
        <div className="absolute left-0 top-1/3 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10" />
        
        {/* Active Progress Bar */}
        <div 
            className="absolute left-0 top-1/3 transform -translate-y-1/2 h-1 bg-green-500 -z-10 transition-all duration-300 ease-in-out"
            style={{ 
                width: `${(STEPS.findIndex(s => s.id === currentStep) / (STEPS.length - 1)) * 100}%` 
            }} 
        />

        {STEPS.map((step, index) => {
          const isCompleted = STEPS.findIndex(s => s.id === currentStep) > index;
          const isActive = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center cursor-pointer" onClick={() => onStepClick(step.id)}>
              <div 
                className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 bg-white
                    ${isActive ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-100' : ''}
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-white border-2 border-gray-300 text-gray-400' : ''}
                `}
              >
                {isCompleted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                ) : isActive ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {/* Icon based on step ID could go here, for now using generic icon */}
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                ) : (
                    <span className="font-semibold text-lg">{index + 1}</span>
                )}
              </div>
              <span 
                className={`
                    mt-3 text-xs font-bold uppercase tracking-wider transition-colors duration-200
                    ${isActive ? 'text-indigo-600' : 'text-gray-400'}
                    ${isCompleted ? 'text-green-500' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
