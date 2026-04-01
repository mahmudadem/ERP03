import React, { useMemo, useState } from 'react';
import {
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  Warehouse,
  Wand2,
} from 'lucide-react';
import { inventoryApi } from '../../../api/inventoryApi';

interface InventoryInitializationWizardProps {
  onComplete: () => void;
}

const stepTitles = ['Welcome', 'Default Warehouse', 'Inventory Settings', 'Confirm & Initialize'];

export const InventoryInitializationWizard: React.FC<InventoryInitializationWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [defaultWarehouseName, setDefaultWarehouseName] = useState('Main Warehouse');
  const [defaultWarehouseCode, setDefaultWarehouseCode] = useState('MAIN');
  const [defaultWarehouseAddress, setDefaultWarehouseAddress] = useState('');

  const [defaultCostCurrency, setDefaultCostCurrency] = useState('');
  const [allowNegativeStock, setAllowNegativeStock] = useState(true);
  const [autoGenerateItemCode, setAutoGenerateItemCode] = useState(false);
  const [itemCodePrefix, setItemCodePrefix] = useState('ITM');
  const [itemCodeNextSeq, setItemCodeNextSeq] = useState(1);

  const stepError = useMemo(() => {
    if (currentStep === 1) {
      if (!defaultWarehouseName.trim()) return 'Warehouse name is required.';
      if (!defaultWarehouseCode.trim()) return 'Warehouse code is required.';
    }

    if (currentStep === 2 && autoGenerateItemCode) {
      if (itemCodeNextSeq <= 0 || Number.isNaN(itemCodeNextSeq)) {
        return 'Starting number must be greater than 0.';
      }
    }

    return null;
  }, [
    autoGenerateItemCode,
    currentStep,
    defaultWarehouseCode,
    defaultWarehouseName,
    itemCodeNextSeq,
  ]);

  const goNext = () => {
    if (stepError) {
      setError(stepError);
      return;
    }

    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, stepTitles.length - 1));
  };

  const goBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const initialize = async () => {
    if (stepError) {
      setError(stepError);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await inventoryApi.initialize({
        defaultWarehouseName: defaultWarehouseName.trim(),
        defaultWarehouseCode: defaultWarehouseCode.trim(),
        defaultCostCurrency: defaultCostCurrency.trim() || undefined,
        allowNegativeStock,
        autoGenerateItemCode,
        itemCodePrefix: autoGenerateItemCode ? itemCodePrefix.trim() || undefined : undefined,
        itemCodeNextSeq: autoGenerateItemCode ? itemCodeNextSeq : undefined,
      });

      onComplete();
    } catch (err: any) {
      console.error('Inventory initialization failed', err);
      setError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Initialization failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const content = (() => {
    if (currentStep === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mx-auto mb-6">
            <Box className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to Inventory Setup</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Complete this 4-step wizard to create your first warehouse and baseline inventory settings.
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Warehouse className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">Warehouse</h3>
              <p className="text-sm text-gray-600">Define your default warehouse for stock operations.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Settings className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">Inventory Settings</h3>
              <p className="text-sm text-gray-600">Set cost currency and negative stock policy.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Wand2 className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">Item Code Rules</h3>
              <p className="text-sm text-gray-600">Optionally auto-generate item codes.</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Default Warehouse</h2>
          <p className="text-sm text-gray-600">Create the default warehouse used for opening stock and movements.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={defaultWarehouseName}
              onChange={(e) => setDefaultWarehouseName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Main Warehouse"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              type="text"
              value={defaultWarehouseCode}
              onChange={(e) => setDefaultWarehouseCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="MAIN"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
            <textarea
              value={defaultWarehouseAddress}
              onChange={(e) => setDefaultWarehouseAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Warehouse address"
              rows={3}
            />
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Inventory Settings</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Cost Currency</label>
            <input
              type="text"
              value={defaultCostCurrency}
              onChange={(e) => setDefaultCostCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Leave blank to use company base currency"
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-gray-900">Allow Negative Stock</div>
              <div className="text-xs text-gray-600">When enabled, stock can go below zero.</div>
            </div>
            <input
              type="checkbox"
              checked={allowNegativeStock}
              onChange={(e) => setAllowNegativeStock(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-gray-900">Auto-generate Item Codes</div>
              <div className="text-xs text-gray-600">Generate item codes based on prefix and sequence.</div>
            </div>
            <input
              type="checkbox"
              checked={autoGenerateItemCode}
              onChange={(e) => setAutoGenerateItemCode(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          {autoGenerateItemCode && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                <input
                  type="text"
                  value={itemCodePrefix}
                  onChange={(e) => setItemCodePrefix(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="ITM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting Number</label>
                <input
                  type="number"
                  min={1}
                  value={itemCodeNextSeq}
                  onChange={(e) => setItemCodeNextSeq(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="1"
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="py-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Confirm & Initialize</h2>
        <p className="text-sm text-gray-600">Review your setup before creating inventory defaults.</p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Warehouse:</span>{' '}
            <span className="text-gray-700">{defaultWarehouseName} ({defaultWarehouseCode})</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Address:</span>{' '}
            <span className="text-gray-700">{defaultWarehouseAddress || 'Not provided'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Default Cost Currency:</span>{' '}
            <span className="text-gray-700">{defaultCostCurrency || 'Company base currency'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Allow Negative Stock:</span>{' '}
            <span className="text-gray-700">{allowNegativeStock ? 'Yes' : 'No'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Auto-generate Item Codes:</span>{' '}
            <span className="text-gray-700">{autoGenerateItemCode ? 'Yes' : 'No'}</span>
          </div>
          {autoGenerateItemCode && (
            <div className="text-sm">
              <span className="font-semibold text-gray-900">Item Code Rule:</span>{' '}
              <span className="text-gray-700">{itemCodePrefix || '(no prefix)'} / next #{itemCodeNextSeq}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          Initialization runs once and then the Inventory dashboard loads with live data.
        </div>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[720px] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            {stepTitles.map((_, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={index} className="flex items-center flex-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-white' : isCurrent ? 'bg-white ring-2 ring-white/50' : 'bg-white/30'
                    }`}
                  />
                  {index < stepTitles.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2">
                      <div className={`h-full transition-all duration-300 ${index < currentStep ? 'bg-white' : 'bg-white/30'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white/90">
              Step {currentStep + 1} of {stepTitles.length}
            </span>
            <span className="text-xs font-semibold text-white">{stepTitles[currentStep]}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 min-h-0">{content}</div>

        {error && (
          <div className="px-8 pb-4">
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>
          </div>
        )}

        <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < stepTitles.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={initialize}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Initialize
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryInitializationWizard;

