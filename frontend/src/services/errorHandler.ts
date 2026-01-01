import toast from 'react-hot-toast';
import i18n from '../i18n/config';
import { ApiError, ErrorSeverity } from '../types/errors';

/**
 * Error Handler Service
 * 
 * Provides two ways to show errors:
 * 1. Toast notifications (for non-blocking messages)
 * 2. Modal dialogs (for critical errors requiring user action)
 */

export interface ErrorHandlerOptions {
  /**
   * Show as modal instead of toast
   */
  useModal?: boolean;
  
  /**
   * Custom title for modal
   */
  modalTitle?: string;
  
  /**
   * Callback when user closes modal
   */
  onClose?: () => void;
  
  /**
   * Duration for toast (ms), default: 4000
   */
  duration?: number;
}

class ErrorHandlerService {
  private modalCallback: ((error: ApiError, options?: ErrorHandlerOptions) => void) | null = null;

  /**
   * Register modal handler (called from ErrorModal component)
   */
  registerModalHandler(handler: (error: ApiError, options?: ErrorHandlerOptions) => void) {
    this.modalCallback = handler;
  }

  /**
   * Translate error code to user-friendly message
   */
  translateError(error: ApiError): string {
    const translationKey = `errors.${error.code}`;
    
    // Check if the translation key exists
    const hasTranslation = i18n.exists(translationKey);
    
    // If it's a generic error code (INFRA_999) or translation is missing, 
    // we should prioritize the technical message if it exists and looks human-readable.
    if (error.code === 'INFRA_999' || !hasTranslation) {
       return error.message || i18n.t('errors.INFRA_999');
    }

    // Try to translate with context
    const translated = i18n.t(translationKey, {
      ...error.context,
      field: error.field,
      // If translation key is missing, i18next returns the key itself.
      // We use defaultValue to return the technical message instead.
      defaultValue: error.message || i18n.t('errors.INFRA_999'),
    });
    
    return translated;
  }

  /**
   * Normalize any error-like object into an ApiError
   */
  normalizeError(error: any): ApiError {
    if (error?.code && error?.message && error?.severity) {
      return {
        ...error,
        code: String(error.code).toUpperCase() as any
      };
    }

    // Handle Axios Error
    if (error?.isAxiosError) {
      const apiError = error.response?.data?.error;
      if (apiError) {
        return {
          ...apiError,
          code: String(apiError.code).toUpperCase() as any
        };
      }

      return {
        code: (error.response?.status === 404 ? 'VOUCH_003' : 'INFRA_999') as any,
        message: error.response?.data?.message || (typeof error.response?.data === 'string' ? error.response.data : null) || error.message || 'Network request failed',
        severity: ErrorSeverity.ERROR,
        timestamp: new Date().toISOString()
      };
    }

    // Handle string error
    if (typeof error === 'string') {
      return {
        code: 'INFRA_999' as any,
        message: error,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date().toISOString()
      };
    }

    // Handle standard Error
    return {
      code: 'INFRA_999' as any,
      message: error?.message || 'An unexpected error occurred',
      severity: ErrorSeverity.ERROR,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Show error to user (Toast or Modal)
   */
  showError(err: any, options?: ErrorHandlerOptions) {
    const error = this.normalizeError(err);
    const message = this.translateError(error);
    
    console.error('[Error]', {
      code: error.code,
      message: error.message,
      severity: error.severity,
      field: error.field,
      context: error.context,
    });

    // Use modal for critical errors or when explicitly requested
    if (options?.useModal || error.severity === ErrorSeverity.CRITICAL) {
      if (this.modalCallback) {
        this.modalCallback(error, options);
      } else {
        // Fallback to alert if modal not registered
        alert(message);
      }
      return;
    }

    // Use toast for other errors
    const duration = options?.duration || 4000;
    
    // Use string comparison for severity (API may return string values)
    const severity = String(error.severity);
    
    if (severity === 'info' || severity === ErrorSeverity.INFO) {
      toast(message, { duration, icon: 'ℹ️' });
    } else if (severity === 'warning' || severity === ErrorSeverity.WARNING) {
      toast(message, { duration, icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E' } });
    } else if (severity === 'critical' || severity === ErrorSeverity.CRITICAL) {
      toast.error(message, { duration: 6000 });
    } else {
      // Default to error toast
      toast.error(message, { duration });
    }
  }

  /**
   * Show success message
   */
  showSuccess(messageKey: string, context?: Record<string, any>) {
    const message = i18n.t(`success.${messageKey}`, context);
    toast.success(message, { duration: 3000 });
  }

  /**
   * Show warning message
   */
  showWarning(message: string, options?: ErrorHandlerOptions) {
    toast(message, { 
      duration: options?.duration || 4000, 
      icon: '⚠️',
      style: { background: '#FEF3C7', color: '#92400E' }
    });
  }

  /**
   * Show info message
   */
  showInfo(message: string, options?: ErrorHandlerOptions) {
    toast(message, { 
      duration: options?.duration || 3000, 
      icon: 'ℹ️',
    });
  }
}

export const errorHandler = new ErrorHandlerService();
