/**
 * RuntimeModeSelector.tsx
 *
 * Radio-button group for AI Assistant runtime mode (BYOK / CREDITS / DISABLED).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';

interface RuntimeModeSelectorProps {
  runtimeMode: 'BYOK' | 'CREDITS' | 'DISABLED';
  allowedRuntimeModes: Array<'BYOK' | 'CREDITS' | 'DISABLED'>;
  canManage: boolean;
  onChange: (mode: 'BYOK' | 'CREDITS' | 'DISABLED') => void;
}

export const RuntimeModeSelector: React.FC<RuntimeModeSelectorProps> = ({
  runtimeMode,
  allowedRuntimeModes,
  canManage,
  onChange,
}) => {
  const { t } = useTranslation('aiAssistant');

  if (allowedRuntimeModes.length <= 1) return null;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        <Shield className="w-4 h-4 inline ltr:mr-1 rtl:ml-1" />
        {t('settings.runtimeMode', 'Connection Mode')}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {allowedRuntimeModes.map((mode) => {
          const isActive = runtimeMode === mode;
          const modeKey = mode === 'CREDITS' ? 'CREDITS' : mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => canManage && onChange(mode)}
              disabled={!canManage}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 text-start transition-all ${
                isActive
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${!canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isActive ? 'border-indigo-600' : 'border-gray-300'
                }`}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {t(`settings.runtimeMode${modeKey}`, mode)}
                </span>
              </div>
              <p className="text-xs text-gray-500 ltr:ml-6 rtl:mr-6">
                {t(`settings.runtimeMode${modeKey}Desc`, '')}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};