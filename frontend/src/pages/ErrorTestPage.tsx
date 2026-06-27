import React from 'react';
import { errorHandler } from '../services/errorHandler';
import { ErrorCode, ErrorSeverity } from '../types/errors';
import { useTranslation } from "react-i18next";

/**
 * Error Handling Test Page
 * 
 * Tests all error types and display methods
 */
export const ErrorTestPage: React.FC = () => {
    const { t } = useTranslation('common');
  const testToastError = () => {
    errorHandler.showError({
      code: ErrorCode.VOUCH_ALREADY_APPROVED,
      message: 'Technical: Voucher is already approved',
      severity: ErrorSeverity.ERROR,
      timestamp: new Date().toISOString(),
      context: { voucherId: 'V-12345' },
    });
  };

  const testToastWarning = () => {
    errorHandler.showError({
      code: ErrorCode.VAL_REQUIRED_FIELD,
      message: 'Technical: Field is required',
      severity: ErrorSeverity.WARNING,
      timestamp: new Date().toISOString(),
      field: 'Email Address',
    });
  };

  const testModalError = () => {
    errorHandler.showError({
      code: ErrorCode.INFRA_DATABASE_ERROR,
      message: 'Technical: Database connection failed',
      severity: ErrorSeverity.CRITICAL,
      timestamp: new Date().toISOString(),
    }, { useModal: true });
  };

  const simulateDuplicate = () => {
    // Simulate what happens when backend returns VAL_DUPLICATE_ENTRY
    errorHandler.showError({
      code: ErrorCode.VAL_DUPLICATE_ENTRY,
      message: 'Technical: Duplicate key value violates unique constraint',
      severity: ErrorSeverity.WARNING,
      field: 'Voucher Number',
      timestamp: new Date().toISOString(),
      context: { field: 'Voucher Number' } 
    });
  };

  const testSuccess = () => {
    errorHandler.showSuccess('voucher_saved');
  };

  const testAPIError = async () => {
    try {
      const response = await fetch('/api/v1/tenant/accounting/voucher-forms/non-existent-id', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.log('API Error Response:', data);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">{t(`Error Handling System Test`)}</h1>
      
      <div className="space-y-6">
        {/* Toast Tests */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{t(`Toast Notifications`)}</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testToastError}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Test Error Toast
            </button>
            <button
              onClick={testToastWarning}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Test Warning Toast
            </button>
            <button
              onClick={testSuccess}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Test Success Toast
            </button>
          </div>
        </section>

        {/* Modal Tests */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{t(`Modal Dialogs`)}</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testModalError}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Test Critical Error Modal
            </button>
            <button
              onClick={simulateDuplicate}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              Simulate Duplicate Error
            </button>
          </div>
        </section>

        {/* API Error Test */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{t(`API Error Handling`)}</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testAPIError}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test API Error (404)
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            This will trigger a real API call to a non-existent endpoint.
            The error should be automatically caught and displayed.
          </p>
        </section>

        {/* Error Codes Reference */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{t(`Error Codes Reference`)}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">{t(`Authentication`)}</h3>
              <ul className="space-y-1 text-gray-600">
                <li>{t(`AUTH_001: Invalid credentials`)}</li>
                <li>{t(`AUTH_002: Token expired`)}</li>
                <li>{t(`AUTH_004: Insufficient permissions`)}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t(`Validation`)}</h3>
              <ul className="space-y-1 text-gray-600">
                <li>{t(`VAL_001: Required field`)}</li>
                <li>{t(`VAL_002: Invalid format`)}</li>
                <li>{t(`VAL_003: Duplicate entry`)}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t(`Voucher`)}</h3>
              <ul className="space-y-1 text-gray-600">
                <li>{t(`VOUCH_001: Already approved`)}</li>
                <li>{t(`VOUCH_003: Not found`)}</li>
                <li>{t(`VOUCH_005: Unbalanced`)}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t(`Infrastructure`)}</h3>
              <ul className="space-y-1 text-gray-600">
                <li>{t(`INFRA_001: Database error`)}</li>
                <li>{t(`INFRA_002: Network error`)}</li>
                <li>{t(`INFRA_999: Unknown error`)}</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
