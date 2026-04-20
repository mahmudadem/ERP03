import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAccounts } from '../../../context/AccountsContext';
import { inventoryApi } from '../../../api/inventoryApi';
import { InitializeSalesPayload, salesApi, WorkflowMode } from '../../../api/salesApi';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import {
  getAccountingModeLabel,
  getWorkflowModeLabel,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';

interface SalesInitializationWizardProps {
  onComplete: () => void;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const stepTitles = ['Welcome', 'Workflow Mode', 'Default Accounts', 'Defaults & Numbering', 'Review'];

const SalesInitializationWizard: React.FC<SalesInitializationWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { validAccounts, isLoading: loadingAccountsContext, getAccountById, refreshAccounts } = useAccounts();
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('SIMPLE');
  const [allowDirectInvoicing, setAllowDirectInvoicing] = useState(true);
  const [requireSOForStockItems, setRequireSOForStockItems] = useState(false);
  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [soNumberPrefix, setSoNumberPrefix] = useState('SO');
  const [dnNumberPrefix, setDnNumberPrefix] = useState('DN');
  const [siNumberPrefix, setSiNumberPrefix] = useState('SI');
  const [srNumberPrefix, setSrNumberPrefix] = useState('SR');
  const [inventorySettings, setInventorySettings] = useState<{
    defaultInventoryAssetAccountId?: string;
    defaultCOGSAccountId?: string;
    accountingMode?: 'INVOICE_DRIVEN' | 'PERPETUAL';
    inventoryAccountingMethod?: 'PERIODIC' | 'PERPETUAL';
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingSettings(true);
        const inventorySettingsResult = await inventoryApi.getSettings().catch(() => null);
        const invSettingsData = inventorySettingsResult
          ? unwrap<any>(inventorySettingsResult)?.data ?? unwrap<any>(inventorySettingsResult)
          : null;

        setInventorySettings(invSettingsData);
        if (resolveInventoryAccountingMode(invSettingsData) === 'PERPETUAL') {
          setWorkflowMode('OPERATIONAL');
        }
      } catch (err) {
        console.error('Failed to load dependencies for sales initialization', err);
      } finally {
        setLoadingSettings(false);
      }
    };

    void loadData();
  }, []);

  const hasRefreshed = useRef(false);
  useEffect(() => {
    if (!hasRefreshed.current) {
      refreshAccounts();
      hasRefreshed.current = true;
    }
  }, [refreshAccounts]);

  const revenueAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'REVENUE' || classification === 'INCOME';
      }),
    [validAccounts]
  );

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'Not Configured';
    const account = getAccountById(accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const isLoading = loadingAccountsContext || loadingSettings;
  const accountingMode = resolveInventoryAccountingMode(inventorySettings);
  const simpleWorkflowDisabled = accountingMode === 'PERPETUAL';

  const stepError = useMemo(() => {
    if (currentStep === 2 && !defaultRevenueAccountId) {
      return 'Default Revenue account is required.';
    }

    if (currentStep === 3 && (Number.isNaN(defaultPaymentTermsDays) || defaultPaymentTermsDays < 0)) {
      return 'Payment terms must be zero or greater.';
    }

    return null;
  }, [currentStep, defaultPaymentTermsDays, defaultRevenueAccountId]);

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
        workflowMode,
        allowDirectInvoicing: workflowMode === 'SIMPLE' ? true : allowDirectInvoicing,
        requireSOForStockItems: workflowMode === 'SIMPLE' ? false : requireSOForStockItems,
        defaultRevenueAccountId,
        defaultPaymentTermsDays,
        soNumberPrefix: soNumberPrefix || 'SO',
        dnNumberPrefix: dnNumberPrefix || 'DN',
        siNumberPrefix: siNumberPrefix || 'SI',
        srNumberPrefix: srNumberPrefix || 'SR',
      };

      await salesApi.initializeSales(payload);
      emitCompanyModulesRefresh({ moduleCode: 'sales' });
      onComplete();
    } catch (err: any) {
      console.error('Sales initialization failed', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Initialization failed. Please try again.'
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
              <h3 className="font-semibold text-gray-900 mb-1">Workflow</h3>
              <p className="text-sm text-gray-600">Choose between simple invoicing and full operational flow.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <DollarSign className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Default Accounts</h3>
              <p className="text-sm text-gray-600">Set the global revenue fallback and review linked inventory accounts.</p>
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
          <h2 className="text-2xl font-bold text-gray-900 text-center">Choose Sales Workflow</h2>
          <p className="text-gray-600 text-center mb-6">
            Workflow controls which sales documents users see. Accounting mode is inherited from Inventory.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Inventory accounting mode: <span className="font-semibold">{getAccountingModeLabel(accountingMode)}</span>
          </div>

          <label className={`flex items-start gap-3 rounded-lg border bg-white p-5 ${simpleWorkflowDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${workflowMode === 'SIMPLE' ? 'border-primary-500' : 'border-gray-200 hover:border-primary-500'}`}>
            <input
              type="radio"
              name="sales-workflow-mode"
              checked={workflowMode === 'SIMPLE'}
              onChange={() => setWorkflowMode('SIMPLE')}
              disabled={simpleWorkflowDisabled}
            />
            <div>
              <div className="font-semibold text-gray-900">Simple</div>
              <div className="text-sm text-gray-600">Show invoices and returns only. Orders and delivery notes stay hidden.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 rounded-lg border bg-white p-5 cursor-pointer ${workflowMode === 'OPERATIONAL' ? 'border-primary-500' : 'border-gray-200 hover:border-primary-500'}`}>
            <input
              type="radio"
              name="sales-workflow-mode"
              checked={workflowMode === 'OPERATIONAL'}
              onChange={() => setWorkflowMode('OPERATIONAL')}
            />
            <div>
              <div className="font-semibold text-gray-900">Operational</div>
              <div className="text-sm text-gray-600">Expose Sales Orders and Delivery Notes alongside invoices and returns.</div>
            </div>
          </label>

          {simpleWorkflowDisabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Perpetual accounting requires the operational workflow because Delivery Notes create inventory accounting.
            </div>
          )}

          {workflowMode === 'OPERATIONAL' ? (
            <div className="space-y-4 pt-2">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={allowDirectInvoicing}
                  onChange={(e) => setAllowDirectInvoicing(e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-gray-900">Allow Direct Invoicing</div>
                  <div className="text-sm text-gray-600">Allow invoices to post directly without a delivery note path.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={requireSOForStockItems}
                  onChange={(e) => setRequireSOForStockItems(e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-gray-900">Require Sales Orders for Stock Items</div>
                  <div className="text-sm text-gray-600">Force stock-item flows to start from a Sales Order.</div>
                </div>
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Simple workflow automatically enables direct invoicing and hides Sales Orders and Delivery Notes from end users.
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-8 max-w-3xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Default Accounts</h2>
          <p className="text-gray-600 text-center mb-4 text-sm px-6">
            Pick a <b>Posting</b> Revenue account to serve as the global fallback.
          </p>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2">Default Revenue Account</label>
            <AccountSelector
              value={defaultRevenueAccountId}
              onChange={(account: any) => setDefaultRevenueAccountId(account?.id || '')}
              accounts={revenueAccounts}
              placeholder="Select REVENUE POSTING account"
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-gray-500">
              Only Posting accounts with classification &quot;REVENUE&quot; are shown here.
            </p>
          </div>

          <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-gray-400" />
              Related Inventory Accounts (View Only)
            </h4>
            <div className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              Accounting mode: <span className="font-semibold">{getAccountingModeLabel(accountingMode)}</span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Default Inventory Asset</span>
                <span className="text-sm font-medium text-gray-600 truncate block mt-1 py-1 px-2 bg-white rounded border border-gray-100">
                  {getAccountLabel(inventorySettings?.defaultInventoryAssetAccountId)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Default COGS Account</span>
                <span className="text-sm font-medium text-gray-600 truncate block mt-1 py-1 px-2 bg-white rounded border border-gray-100">
                  {getAccountLabel(inventorySettings?.defaultCOGSAccountId)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-gray-400 italic">
              These inventory defaults are shared with the sales posting engine and drive stock recognition when needed.
            </p>
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
            <h3 className="text-sm text-gray-600 mb-1">Workflow</h3>
            <p className="text-sm text-gray-900">Mode: {getWorkflowModeLabel(workflowMode)}</p>
            {workflowMode === 'OPERATIONAL' ? (
              <>
                <p className="text-sm text-gray-900">Allow Direct Invoicing: {allowDirectInvoicing ? 'Yes' : 'No'}</p>
                <p className="text-sm text-gray-900">Require SO for Stock Items: {requireSOForStockItems ? 'Yes' : 'No'}</p>
              </>
            ) : (
              <p className="text-sm text-gray-900">Users will see invoices and returns only.</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Finance & Accounts</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Default Revenue Account</span>
                <span className="font-semibold text-gray-900">{getAccountLabel(defaultRevenueAccountId)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 text-gray-400 italic">
                <span className="flex items-center gap-1.5 opacity-70">
                  <Settings className="w-3 h-3" />
                  Inventory Accounting Mode
                </span>
                <span className="text-xs truncate max-w-[200px]">{getAccountingModeLabel(accountingMode)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 text-gray-400 italic">
                <span className="flex items-center gap-1.5 opacity-70">
                  <Settings className="w-3 h-3" />
                  Default Inventory Asset (From Inventory)
                </span>
                <span className="text-xs truncate max-w-[200px]">{getAccountLabel(inventorySettings?.defaultInventoryAssetAccountId)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-400 italic">
                <span className="flex items-center gap-1.5 opacity-70">
                  <Settings className="w-3 h-3" />
                  Default COGS Account (From Inventory)
                </span>
                <span className="text-xs truncate max-w-[200px]">{getAccountLabel(inventorySettings?.defaultCOGSAccountId)}</span>
              </div>
            </div>
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
