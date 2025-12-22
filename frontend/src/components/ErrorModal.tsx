import React, { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { ApiError, ErrorSeverity } from '../types/errors';
import { errorHandler, ErrorHandlerOptions } from '../services/errorHandler';

export const ErrorModal: React.FC = () => {
  const [error, setError] = useState<ApiError | null>(null);
  const [options, setOptions] = useState<ErrorHandlerOptions>({});

  useEffect(() => {
    // Register this component as the modal handler
    errorHandler.registerModalHandler((err, opts) => {
      setError(err);
      setOptions(opts || {});
    });
  }, []);

  const handleClose = () => {
    setError(null);
    options.onClose?.();
  };

  if (!error) return null;

  const getIcon = () => {
    switch (error.severity) {
      case ErrorSeverity.INFO:
        return <Info className="w-6 h-6 text-blue-500" />;
      case ErrorSeverity.WARNING:
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getTitle = () => {
    if (options.modalTitle) return options.modalTitle;
    
    switch (error.severity) {
      case ErrorSeverity.INFO:
        return 'Information';
      case ErrorSeverity.WARNING:
        return 'Warning';
      case ErrorSeverity.ERROR:
        return 'Error';
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
    }
  };

  const message = errorHandler.translateError(error);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {getIcon()}
            <h2 className="text-lg font-semibold text-gray-900">{getTitle()}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 whitespace-pre-wrap">{message}</p>
          
          {/* Show error code for debugging */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono text-gray-600">
              <div>Code: {error.code}</div>
              {error.field && <div>Field: {error.field}</div>}
              {error.context && (
                <div>Context: {JSON.stringify(error.context, null, 2)}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
