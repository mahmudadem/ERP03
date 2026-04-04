import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import { AccountDTO, accountingApi } from '../../../api/accountingApi';
import { InitializeSalesPayload, salesApi, SalesControlMode } from '../../../api/salesApi';

interface SalesInitializationWizardProps {
  onComplete: () => void;
}

const accountLabel = (account: AccountDTO): string =>
  `${account.userCode || account.code || account.systemCode} - ${account.name}`;

const stepTitles = ['Welcome', 'Sales Mode', 'Default Accounts', 'Defaults & Numbering', 'Review'];

const SalesInitializationWizard: React.FC<SalesInitializationWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [salesControlMode, setSalesControlMode] = useState<SalesControlMode>('SIMPLE');
  const [defaultARAccountId, setDefaultARAccountId] = useState('');
  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState('');
  const [defaultCOGSAccountId, setDefaultCOGSAccountId] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [soNumberPrefix, setSoNumberPrefix] = useState('SO');
  const [dnNumberPrefix, setDnNumberPrefix] = useState('DN');
  const [siNumberPrefix, setSiNumberPrefix] = useState('SI');
  const [srNumberPrefix, setSrNumberPrefix] = useState('SR');

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const result = await accountingApi.getAccounts();
        setAccounts(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error('Failed to load accounts for sales initialization', err);
        setAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, []);

  const stepError = useMemo(() => {
    if (currentStep === 2) {
      if (!defaultARAccountId) return 'Default AR account is required.';
      if (!defaultRevenueAccountId) return 'Default Revenue account is required.';
    }

    if (currentStep === 3) {
      if (Number.isNaN(defaultPaymentTermsDays) || defaultPaymentTermsDays < 0) {
        return 'Payment terms must be zero or greater.';
      }
    }

    return null;
  }, [currentStep, defaultARAccountId, defaultPaymentTermsDays, defaultRevenueAccountId]);

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

      const payload: InitializeSalesPayload = {
        salesControlMode,
        defaultARAccountId,
        defaultRevenueAccountId,
        defaultCOGSAccountId: defaultCOGSAccountId || undefined,
        defaultPaymentTermsDays,
        soNumberPrefix: soNumberPrefix || 'SO',
        dnNumberPrefix: dnNumberPrefix || 'DN',
        siNumberPrefix: siNumberPrefix || 'SI',
        srNumberPrefix: srNumberPrefix || 'SR',
      };

      await salesApi.initializeSales(payload);
      onComplete();
    } catch (err: any) {
      console.error('Sales initialization failed', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
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
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Sales Setup</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Configure your sales workflow and accounting defaults before creating transactions.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Calculator className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Sales Mode</h3>
              <p className="text-sm text-gray-600">Choose SIMPLE or CONTROLLED policy.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <DollarSign className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Default Accounts</h3>
              <p className="text-sm text-gray-600">Set AR, Revenue, and optional COGS accounts.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Settings className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Numbering</h3>
              <p className="text-sm text-gray-600">Configure prefixes and default payment terms.</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-8 max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Select Sales Control Mode</h2>
          <p className="text-gray-600 text-center mb-6">
            This controls stock flow between Sales Order, Delivery Note, and Sales Invoice.
          </p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input
              type="radio"
              name="salesControlMode"
              value="SIMPLE"
              checked={salesControlMode === 'SIMPLE'}
              onChange={() => setSalesControlMode('SIMPLE')}
            />
            <div>
              <div className="font-semibold text-gray-900">SIMPLE</div>
              <div className="text-sm text-gray-600">Sales invoices can handle stock delivery directly.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input
              type="radio"
              name="salesControlMode"
              value="CONTROLLED"
              checked={salesControlMode === 'CONTROLLED'}
              onChange={() => setSalesControlMode('CONTROLLED')}
            />
            <div>
              <div className="font-semibold text-gray-900">CONTROLLED</div>
              <div className="text-sm text-gray-600">Stock items must flow through SO → DN → SI.</div>
            </div>
          </label>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-8 max-w-3xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Default Accounts</h2>
          <p className="text-gray-600 text-center mb-4">Required accounts must be set before initialization.</p>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Default AR Account</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={defaultARAccountId}
              onChange={(e) => setDefaultARAccountId(e.target.value)}
              disabled={loadingAccounts}
            >
              <option value="">{loadingAccounts ? 'Loading accounts...' : 'Select AR account'}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Default Revenue Account</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={defaultRevenueAccountId}
              onChange={(e) => setDefaultRevenueAccountId(e.target.value)}
              disabled={loadingAccounts}
            >
              <option value="">Select Revenue account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Default COGS Account (Optional)</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={defaultCOGSAccountId}
              onChange={(e) => setDefaultCOGSAccountId(e.target.value)}
              disabled={loadingAccounts}
            >
              <option value="">Optional</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="py-8 max-w-3xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Defaults & Numbering</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Default Payment Terms (Days)</label>
            <input
              type="number"
              min={0}
              value={defaultPaymentTermsDays}
              onChange={(e) => setDefaultPaymentTermsDays(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">SO Prefix</label>
              <input
                type="text"
                value={soNumberPrefix}
                onChange={(e) => setSoNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">DN Prefix</label>
              <input
                type="text"
                value={dnNumberPrefix}
                onChange={(e) => setDnNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">SI Prefix</label>
              <input
                type="text"
                value={siNumberPrefix}
                onChange={(e) => setSiNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">SR Prefix</label>
              <input
                type="text"
                value={srNumberPrefix}
                onChange={(e) => setSrNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="py-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Review & Confirm</h2>
        <p className="text-gray-600 mb-6 text-center">Confirm your configuration before initializing Sales.</p>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm text-gray-600 mb-1">Sales Mode</h3>
            <p className="text-lg font-semibold text-gray-900">{salesControlMode}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm text-gray-600 mb-2">Accounts</h3>
            <p className="text-sm text-gray-900">AR: {defaultARAccountId || 'Not selected'}</p>
            <p className="text-sm text-gray-900">Revenue: {defaultRevenueAccountId || 'Not selected'}</p>
            <p className="text-sm text-gray-900">COGS: {defaultCOGSAccountId || 'Not selected'}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm text-gray-600 mb-2">Defaults</h3>
            <p className="text-sm text-gray-900">Payment Terms: {defaultPaymentTermsDays} days</p>
            <p className="text-sm text-gray-900">
              Prefixes: {soNumberPrefix || 'SO'} / {dnNumberPrefix || 'DN'} / {siNumberPrefix || 'SI'} / {srNumberPrefix || 'SR'}
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            Initialization is required once per company. You can adjust settings later from Sales Settings.
          </p>
        </div>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[750px] flex flex-col bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
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
            <span className="text-xs font-semibold text-white">{Math.round(((currentStep + 1) / stepTitles.length) * 100)}%</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 min-h-0">{content}</div>

        {error && (
          <div className="px-8 pb-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          </div>
        )}

        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < stepTitles.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={initialize}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Setup
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesInitializationWizard;
