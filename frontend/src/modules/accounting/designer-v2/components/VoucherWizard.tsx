/**
 * VoucherWizard.tsx
 * 
 * Main wizard container that orchestrates all 5 steps.
 * Handles navigation, progress, and state management.
 */

import React from 'react';
import { useVoucherDesignerV2 } from '../hooks/useVoucherDesignerV2';
import { VoucherTypeCode } from '../types/VoucherLayoutV2';
import {
  StepSelectType,
  StepFieldSelection,
  StepLayoutEditor,
  StepLineConfig,
  StepValidation,
  StepReview
} from './steps';

interface Props {
  initialType?: VoucherTypeCode;
  onClose: () => void;
  onSave?: () => void;
}

const STEP_INFO = [
  { id: 'SELECT_TYPE', label: 'Type', number: 1 },
  { id: 'FIELD_SELECTION', label: 'Fields', number: 2 },
  { id: 'LINE_CONFIG', label: 'Line Table', number: 3 },
  { id: 'LAYOUT_EDITOR', label: 'Layout', number: 4 },
  { id: 'VALIDATION', label: 'Validate', number: 5 },
  { id: 'REVIEW', label: 'Review', number: 6 }
];

export const VoucherWizard: React.FC<Props> = ({ initialType, onClose, onSave }) => {
  const designer = useVoucherDesignerV2(initialType);

  const handleSave = async () => {
    const success = await designer.save();
    
    if (success) {
      onSave?.();
      onClose();
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (designer.currentStep) {
      case 'SELECT_TYPE':
        return (
          <StepSelectType
            selectedType={designer.voucherType}
            onSelect={designer.selectVoucherType}
          />
        );

      case 'FIELD_SELECTION':
        if (!designer.voucherType) return null;
        return (
          <StepFieldSelection
            voucherType={designer.voucherType}
            selectedFieldIds={designer.selectedFieldIds}
            personalFields={designer.personalFields}
            onFieldsChange={designer.updateFieldSelection}
          />
        );

      case 'LAYOUT_EDITOR':
        if (!designer.voucherType) return null;
        return (
          <StepLayoutEditor
            voucherType={designer.voucherType}
            fields={designer.allFields}
            mode={designer.displayMode}
            onFieldsUpdate={designer.updateFields}
            onModeChange={designer.updateDisplayMode}
          />
        );

      case 'LINE_CONFIG':
        if (!designer.voucherType) return null;
        return (
          <StepLineConfig
            columns={designer.lineColumns || []}
            onColumnsChange={designer.updateLineColumns}
          />
        );

      case 'VALIDATION':
        if (!designer.voucherType) return null;
        return (
          <StepValidation
            voucherType={designer.voucherType}
            fields={designer.allFields}
          />
        );

      case 'REVIEW':
        if (!designer.voucherType) return null;
        return (
          <StepReview
            voucherType={designer.voucherType}
            fields={designer.allFields}
            mode={designer.displayMode}
          />
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  // Get current step info
  const getCurrentStepInfo = () => {
    return STEP_INFO.find(s => s.id === designer.currentStep) || STEP_INFO[0];
  };

  const currentStepInfo = getCurrentStepInfo();
  const currentStepIndex = STEP_INFO.findIndex(s => s.id === designer.currentStep);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl overflow-hidden">
      {/* Header with Progress */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Voucher Designer</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2">
          {STEP_INFO.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors
                  ${index <= currentStepIndex
                    ? 'bg-white text-indigo-600'
                    : 'bg-indigo-500/30 text-white/60'
                  }
                `}
              >
                {index < currentStepIndex ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {/* Connector Line */}
              {index < STEP_INFO.length - 1 && (
                <div
                  className={`
                    flex-1 h-1 rounded transition-colors
                    ${index < currentStepIndex
                      ? 'bg-white'
                      : 'bg-indigo-500/30'
                    }
                  `}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Name */}
        <div className="mt-3 text-white/90 text-sm">
          Step {currentStepInfo.number} of {STEP_INFO.length}: {currentStepInfo.label}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderStepContent()}
      </div>

      {/* Footer Actions */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
        <button
          onClick={designer.prevStep}
          disabled={currentStepIndex === 0}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          Previous
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>

          {designer.currentStep === 'REVIEW' ? (
            <button
              onClick={handleSave}
              disabled={designer.loading || !designer.canProceed}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
            >
              {designer.loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save & Activate
                </>
              )}
            </button>
          ) : (
            <button
              onClick={designer.nextStep}
              disabled={!designer.canProceed}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {designer.error && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-bold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-700">{designer.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
