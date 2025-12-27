import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onCancel,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200">
        
        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
             {/* Icon - Optional but nice */}
             {/* <div className="p-2 bg-amber-50 rounded-full flex-shrink-0">
               <AlertTriangle className="w-6 h-6 text-amber-500" />
             </div> */}
             
             <div>
               <h3 className="text-lg font-bold text-slate-900 mb-2">Unsaved Changes</h3>
               <p className="text-slate-600 leading-relaxed">
                 You have unsaved changes. Are you sure you want to close without saving?
               </p>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white text-slate-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            Close Without Saving
          </button>
        </div>
      </div>
    </div>
  );
};
