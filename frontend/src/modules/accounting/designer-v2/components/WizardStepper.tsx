import React from 'react';

interface Props {
  currentStep: string;
  onStepClick: (id: string) => void;
}

const STEP_INFO = [
  { id: 'SELECT_TYPE', label: 'Type', number: 1 },
  { id: 'FIELD_SELECTION', label: 'Fields', number: 2 },
  { id: 'LINE_CONFIG', label: 'Lines', number: 3 },
  { id: 'LAYOUT_EDITOR', label: 'Layout', number: 4 },
  { id: 'VALIDATION', label: 'Validate', number: 5 },
  { id: 'REVIEW', label: 'Review', number: 6 }
];

export const WizardStepper: React.FC<Props> = ({ currentStep, onStepClick }) => {
  const currentIndex = STEP_INFO.findIndex(s => s.id === currentStep);

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-between">
        {STEP_INFO.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id} className="relative flex-1">
              {index < STEP_INFO.length - 1 && (
                <div className="absolute top-4 left-1/2 w-full h-0.5 bg-gray-200">
                  <div 
                    className={`h-full transition-all ${isCompleted ? 'bg-indigo-600' : 'bg-gray-200'}`}
                  />
                </div>
              )}
              
              <button
                onClick={() => onStepClick(step.id)}
                className="relative flex flex-col items-center group"
              >
                <span
                  className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                    ${isCurrent ? 'bg-indigo-600 text-white' : ''}
                    ${isCompleted ? 'bg-indigo-600 text-white' : ''}
                    ${!isCurrent && !isCompleted ? 'bg-white border-2 border-gray-300 text-gray-500' : ''}
                  `}
                >
                  {step.number}
                </span>
                <span className={`mt-2 text-xs font-medium ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
