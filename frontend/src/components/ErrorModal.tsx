import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { ApiError, ErrorSeverity } from '../types/errors';
import { errorHandler, ErrorHandlerOptions } from '../services/errorHandler';

export const ErrorModal: React.FC = () => {
  const { t } = useTranslation('common');
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
    const severity = String(error.severity).toLowerCase();
    switch (severity) {
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'critical':
        return <AlertCircle className="w-6 h-6 text-red-600 fill-red-600 stroke-white" />;
      default:
        return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getTitle = () => {
    if (options.modalTitle) return options.modalTitle;

    const severity = String(error.severity).toLowerCase();
    switch (severity) {
      case 'info':
        return t('errorModal.title.info', 'Information');
      case 'warning':
        return t('errorModal.title.warning', 'Warning');
      case 'critical':
        return t('errorModal.title.critical', 'Critical Error');
      case 'error':
      default:
        return t('errorModal.title.error', 'Error');
    }
  };

  const message = errorHandler.translateError(error);

  return (
    <div className="fixed inset-0 z-[1000001] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-[var(--color-bg-primary)] rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            {getIcon()}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">{getTitle()}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-[var(--color-text-secondary)] whitespace-pre-wrap">{message}</p>
          
          {/* Show error code for debugging */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-[var(--color-bg-tertiary)] rounded text-xs font-mono text-gray-600 dark:text-[var(--color-text-secondary)]">
              <div>{t(`Code:`)} {error.code}</div>
              {error.field && <div>{t(`Field:`)} {error.field}</div>}
              {error.context && (
                <div>{t(`Context:`)} {JSON.stringify(error.context, null, 2)}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-tertiary)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {t('errorModal.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
};
