import React, { useState } from 'react';
import { 
  ArrowLeft, ArrowRight, Check, CheckCircle2, 
  LayoutTemplate, FileText, Save, X
} from 'lucide-react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../../../designer-engine/types/FieldDefinition';
import { UIMode } from '../types';
import { GenericVoucherRenderer } from '../../components/shared/GenericVoucherRenderer';
import { errorHandler } from '../../../../services/errorHandler';

/**
 * VoucherDesigner - Simplified for Canonical Schema V2
 * 
 * This component has been updated to use canonical VoucherTypeDefinition only.
 * All legacy types (VoucherTypeConfig, VoucherRule, VoucherAction) removed.
 */

const STEPS = [
  { id: 1, title: 'Basic Info', icon: FileText },
  { id: 2, title: 'Fields', icon: LayoutTemplate },
  { id: 3, title: 'Review', icon: CheckCircle2 },
];

interface VoucherDesignerProps {
  initialDefinition?: VoucherTypeDefinition | null;
  onSave?: (definition: VoucherTypeDefinition) => void;
  onCancel?: () => void;
}

export const VoucherDesigner: React.FC<VoucherDesignerProps> = ({ 
  initialDefinition, 
  onSave, 
  onCancel 
}) => {
  // GUARD: Validate if editing existing definition
  if (initialDefinition && initialDefinition.schemaVersion !== 2) {
    throw new Error('Cleanup violation: legacy view type detected. Only Schema V2 allowed.');
  }

  const [currentStep, setCurrentStep] = useState(1);
  const [definition, setDefinition] = useState<Partial<VoucherTypeDefinition>>(
    initialDefinition || {
      id: `voucher_${Date.now()}`,
      companyId: '', // Will be set by context
      name: 'New Voucher Type',
      code: 'NEW_VOUCHER',
      module: 'ACCOUNTING',
      schemaVersion: 2,
      headerFields: [],
      tableColumns: [],
      layout: {}
    }
  );

  const [previewMode, setPreviewMode] = useState<UIMode>('windows');

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    // GUARD: Validate before save
    if (!definition.name || !definition.code) {
      errorHandler.showError({
        code: 'VAL_001',
        message: 'Please fill in all required fields',
        severity: 'WARNING'
      } as any);
      return;
    }

    if (definition.schemaVersion !== 2) {
      throw new Error('Cannot save: schemaVersion must be 2');
    }

    // Save canonical definition
    onSave?.(definition as VoucherTypeDefinition);
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voucher Name *
              </label>
              <input
                type="text"
                value={definition.name || ''}
                onChange={(e) => setDefinition({ ...definition, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Payment Voucher"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voucher Code *
              </label>
              <input
                type="text"
                value={definition.code || ''}
                onChange={(e) => setDefinition({ ...definition, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. PAYMENT_VOUCHER"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Schema V2:</strong> This voucher uses the canonical schema.
                Additional fields and posting roles can be configured after creation.
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Field Configuration</h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Note:</strong> Field configuration is simplified in this version.
                For advanced field setup, use more advanced admin tools or direct schema configuration.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fields: {definition.headerFields?.length || 0} configured
              </label>
              <p className="text-xs text-gray-500">
                Header fields will be configured based on your voucher type.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table Type
              </label>
              <select
                value={(definition.tableColumns?.length || 0) > 0 ? 'multi-line' : 'single-line'}
                onChange={(e) => {
                  if (e.target.value === 'multi-line') {
                    setDefinition({
                      ...definition,
                      tableColumns: [
                        { fieldId: 'account', width: '40%' },
                        { fieldId: 'debit', width: '20%' },
                        { fieldId: 'credit', width: '20%' },
                        { fieldId: 'description', width: '20%' }
                      ]
                    });
                  } else {
                    setDefinition({ ...definition, tableColumns: [] });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="single-line">Single Line</option>
                <option value="multi-line">Multi-Line Table</option>
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Review & Save</h3>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{definition.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Code:</span>
                <span className="font-medium">{definition.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Module:</span>
                <span className="font-medium">{definition.module}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Schema Version:</span>
                <span className="font-medium">{definition.schemaVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">
                  {(definition.tableColumns?.length || 0) > 0 ? 'Multi-Line' : 'Single-Line'}
                </span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Ready to save!</strong> This definition will be saved with Schema V2.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {initialDefinition ? 'Edit Voucher Type' : 'Create New Voucher Type'}
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-2 mt-4">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  step.id === currentStep
                    ? 'bg-indigo-600 text-white'
                    : step.id < currentStep
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <step.icon size={16} />
                <span className="text-sm font-medium">{step.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <ArrowRight size={16} className="text-gray-400" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-between shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} />
          Previous
        </button>

        {currentStep < STEPS.length ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Next
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Save size={16} />
            Save Definition
          </button>
        )}
      </div>
    </div>
  );
};