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
    
    // Try to translate with context
    const translated = i18n.t(translationKey, {
      ...error.context,
      field: error.field,
      defaultValue: error.message, // Fallback to technical message
    });
    
    return translated;
  }

  /**
   * Show error to user (Toast or Modal)
   */
  showError(error: ApiError, options?: ErrorHandlerOptions) {
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
    
    switch (error.severity) {
      case ErrorSeverity.INFO:
        toast(message, { duration, icon: 'ℹ️' });
        break;
      case ErrorSeverity.WARNING:
        toast(message, { duration, icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E' } });
        break;
      case ErrorSeverity.ERROR:
        toast.error(message, { duration });
        break;
      case ErrorSeverity.CRITICAL:
        toast.error(message, { duration: 6000 });
        break;
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
