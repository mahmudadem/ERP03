/**
 * ComponentConfigModal.tsx
 * 
 * Modal to configure component-specific settings.
 * Different config forms based on component type.
 */

import React, { useState } from 'react';
import { FieldComponentType, ComponentConfig } from '../types/FieldComponents';

interface Props {
  componentType: FieldComponentType;
  config?: ComponentConfig;
  onSave: (config: ComponentConfig) => void;
  onClose: () => void;
}

export const ComponentConfigModal: React.FC<Props> = ({
  componentType,
  config = {},
  onSave,
  onClose
}) => {
  const [localConfig, setLocalConfig] = useState<ComponentConfig>(config);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  // Render config form based on component type
  const renderConfigForm = () => {
    switch (componentType) {
      case 'NUMBER_INPUT':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Value
                </label>
                <input
                  type="number"
                  value={localConfig.numberInput?.min ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    numberInput: {
                      ...localConfig.numberInput,
                      min: e.target.value ? parseFloat(e.target.value) : undefined
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="No minimum"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Value
                </label>
                <input
                  type="number"
                  value={localConfig.numberInput?.max ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    numberInput: {
                      ...localConfig.numberInput,
                      max: e.target.value ? parseFloat(e.target.value) : undefined
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="No maximum"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decimal Places
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={localConfig.numberInput?.decimals ?? 2}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    numberInput: {
                      ...localConfig.numberInput,
                      decimals: parseInt(e.target.value)
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step
                </label>
                <input
                  type="number"
                  step="any"
                  value={localConfig.numberInput?.step ?? 1}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    numberInput: {
                      ...localConfig.numberInput,
                      step: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prefix
                </label>
                <input
                  type="text"
                  value={localConfig.numberInput?.prefix ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    numberInput: {
                      ...localConfig.numberInput,
                      prefix: e.target.value
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., $, €"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suffix
                </label>
                <input
                  type="text"
                  value={localConfig.numberInput?.suffix ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    numberInput: {
                      ...localConfig.numberInput,
                      suffix: e.target.value
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., %, kg"
                />
              </div>
            </div>
          </div>
        );

      case 'TEXT_INPUT':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Length
                </label>
                <input
                  type="number"
                  min="0"
                  value={localConfig.textInput?.minLength ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    textInput: {
                      ...localConfig.textInput,
                      minLength: e.target.value ? parseInt(e.target.value) : undefined
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="No minimum"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Length
                </label>
                <input
                  type="number"
                  min="0"
                  value={localConfig.textInput?.maxLength ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    textInput: {
                      ...localConfig.textInput,
                      maxLength: e.target.value ? parseInt(e.target.value) : undefined
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="No maximum"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pattern (Regex)
              </label>
              <input
                type="text"
                value={localConfig.textInput?.pattern ?? ''}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  textInput: {
                    ...localConfig.textInput,
                    pattern: e.target.value
                  }
                })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., ^[A-Z0-9]+$"
              />
            </div>
          </div>
        );

      case 'DATE_PICKER':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Format
              </label>
              <select
                value={localConfig.datePicker?.format ?? 'DD/MM/YYYY'}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  datePicker: {
                    ...localConfig.datePicker,
                    format: e.target.value
                  }
                })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.datePicker?.defaultToToday ?? true}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    datePicker: {
                      ...localConfig.datePicker,
                      defaultToToday: e.target.checked
                    }
                  })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Default to today's date
                </span>
              </label>
            </div>
          </div>
        );

      case 'FILE_UPLOAD':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accepted File Types
              </label>
              <input
                type="text"
                value={localConfig.fileUpload?.acceptedTypes?.join(', ') ?? ''}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  fileUpload: {
                    ...localConfig.fileUpload,
                    acceptedTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }
                })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder=".pdf, .jpg, .png"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  min="0"
                  value={localConfig.fileUpload?.maxSize ? localConfig.fileUpload.maxSize / (1024 * 1024) : ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    fileUpload: {
                      ...localConfig.fileUpload,
                      maxSize: e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Files
                </label>
                <input
                  type="number"
                  min="1"
                  value={localConfig.fileUpload?.maxFiles ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    fileUpload: {
                      ...localConfig.fileUpload,
                      maxFiles: e.target.value ? parseInt(e.target.value) : undefined
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="5"
                />
              </div>
            </div>
          </div>
        );

      case 'SLIDER':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum
                </label>
                <input
                  type="number"
                  value={localConfig.slider?.min ?? 0}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    slider: {
                      ...localConfig.slider!,
                      min: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum
                </label>
                <input
                  type="number"
                  value={localConfig.slider?.max ?? 100}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    slider: {
                      ...localConfig.slider!,
                      max: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step
                </label>
                <input
                  type="number"
                  value={localConfig.slider?.step ?? 1}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    slider: {
                      ...localConfig.slider!,
                      step: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.slider?.showValue ?? true}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    slider: {
                      ...localConfig.slider!,
                      showValue: e.target.checked
                    }
                  })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Show value label
                </span>
              </label>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-gray-500">
            <p>No configuration needed for this component</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Configure Component</h3>
              <p className="text-sm text-white/80 mt-1">{componentType.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {renderConfigForm()}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
