import React from 'react';
import { useVoucherDesigner, STEPS } from '../hooks/useVoucherDesigner';
import { Button } from '../../../../components/ui/Button';

import { StepBasicInfo } from './steps/StepBasicInfo';
import { StepRules } from './steps/StepRules';
import { StepFields } from './steps/StepFields';
import { StepJournal } from './steps/StepJournal';
import { StepLayout } from './steps/StepLayout';
import { StepActions } from './steps/StepActions';
import { StepReview } from './steps/StepReview';
import { WizardStepper } from './WizardStepper';

interface Props {
  initialCode?: string;
  onClose?: () => void;
}

export const VoucherWizard: React.FC<Props> = ({ initialCode, onClose }) => {
  const {
    currentStep,
    setCurrentStep,
    definition,
    updateDefinition,
    loading,
    nextStep,
    prevStep,
    save
  } = useVoucherDesigner(initialCode);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'BASIC':
        return <StepBasicInfo definition={definition} updateDefinition={updateDefinition} initialCode={initialCode} />;
      case 'RULES':
        return <StepRules definition={definition} updateDefinition={updateDefinition} />;
      case 'FIELDS':
        return <StepFields definition={definition} updateDefinition={updateDefinition} />;
      case 'JOURNAL':
        return <StepJournal definition={definition} updateDefinition={updateDefinition} />;
      case 'LAYOUT':
        return <StepLayout definition={definition} updateDefinition={updateDefinition} />;
      case 'ACTIONS':
        return <StepActions definition={definition} updateDefinition={updateDefinition} />;
      case 'REVIEW':
        return <StepReview definition={definition} />;
      default:
        return <div className="p-4 text-center text-gray-500">Step content for {currentStep} under construction.</div>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl overflow-hidden">


      {/* Stepper Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Voucher Type Designer</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">×</button>
        </div>
        <WizardStepper currentStep={currentStep} onStepClick={(id) => setCurrentStep(id as any)} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ zoom: 0.8 }}>
          {renderStepContent()}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between">
        <Button variant="secondary" onClick={prevStep} disabled={currentStep === 'BASIC'}>
          Previous
        </Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            {currentStep === 'REVIEW' ? (
                <Button variant="primary" onClick={save} disabled={loading}>
                    {loading ? 'Saving...' : 'Save & Activate'}
                </Button>
            ) : (
                <Button variant="primary" onClick={nextStep}>
                    Next
                </Button>
            )}
        </div>
      </div>
    </div>
  );
};
