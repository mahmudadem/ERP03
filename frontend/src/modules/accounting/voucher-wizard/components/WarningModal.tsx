/**
 * Warning Modal Component
 * 
 * Displays a professional warning dialog for system-protected actions
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  suggestion?: string;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  suggestion
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <h3 className="text-lg font-bold text-amber-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-amber-100 rounded-lg transition-colors text-amber-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed mb-4">
            {message}
          </p>
          
          {suggestion && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-1">💡 Suggestion:</p>
              <p className="text-sm text-blue-700">{suggestion}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
