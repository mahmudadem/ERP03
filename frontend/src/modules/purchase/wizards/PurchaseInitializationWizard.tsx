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
import { inventoryApi } from '../../../api/inventoryApi';
import { InitializePurchasesPayload, purchasesApi } from '../../../api/purchasesApi';
import { WorkflowMode } from '../../../api/salesApi';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import {
  getAccountingModeLabel,
  getWorkflowModeLabel,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';

interface PurchaseInitializationWizardProps {
  onComplete: () => void;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const stepTitles = ['Welcome', 'Workflow Mode', 'Default Accounts', 'Defaults & Numbering', 'Review'];

const PurchaseInitializationWizard: React.FC<PurchaseInitializationWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { validAccounts, isLoading: loadingAccountsContext, getAccountById, refreshAccounts } = useAccounts();
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('SIMPLE');
  const [allowDirectInvoicing, setAllowDirectInvoicing] = useState(true);
  const [requirePOForStockItems, setRequirePOForStockItems] = useState(false);
  const [defaultAPAccountId, setDefaultAPAccountId] = useState('');
  const [defaultPurchaseExpenseAccountId, setDefaultPurchaseExpenseAccountId] = useState('');
  const [defaultGRNIAccountId, setDefaultGRNIAccountId] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [poNumberPrefix, setPoNumberPrefix] = useState('PO');
  const [grnNumberPrefix, setGrnNumberPrefix] = useState('GRN');
  const [piNumberPrefix, setPiNumberPrefix] = useState('PI');
  const [prNumberPrefix, setPrNumberPrefix] = useState('PR');
  const [inventorySettings, setInventorySettings] = useState<{
    defaultInventoryAssetAccountId?: string;
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
        console.error('Failed to load dependencies for purchases initialization', err);
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

  const liabilityAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'LIABILITY';
      }),
    [validAccounts]
  );

  const expenseAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'EXPENSE';
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
    if (currentStep === 2) {
      if (!defaultAPAccountId) return 'Default Accounts Payable account is required.';
      if (accountingMode === 'PERPETUAL' && !defaultGRNIAccountId) {
        return 'Default GRNI account is required for perpetual purchasing workflows.';
      }
    }

    if (currentStep === 3 && (Number.isNaN(defaultPaymentTermsDays) || defaultPaymentTermsDays < 0)) {
      return 'Payment terms must be zero or greater.';
    }

    return null;
  }, [accountingMode, currentStep, defaultAPAccountId, defaultGRNIAccountId, defaultPaymentTermsDays]);

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

      const payload: InitializePurchasesPayload = {
        workflowMode,
        allowDirectInvoicing: workflowMode === 'SIMPLE' ? true : allowDirectInvoicing,
        requirePOForStockItems: workflowMode === 'SIMPLE' ? false : requirePOForStockItems,
        defaultAPAccountId,
        defaultPurchaseExpenseAccountId: defaultPurchaseExpenseAccountId || undefined,
        defaultGRNIAccountId: accountingMode === 'PERPETUAL' ? defaultGRNIAccountId || undefined : undefined,
        defaultPaymentTermsDays,
        poNumberPrefix: poNumberPrefix || 'PO',
        grnNumberPrefix: grnNumberPrefix || 'GRN',
        piNumberPrefix: piNumberPrefix || 'PI',
        prNumberPrefix: prNumberPrefix || 'PR',
      };

      await purchasesApi.initializePurchases(payload);
      emitCompanyModulesRefresh({ moduleCode: 'purchase' });
      onComplete();
    } catch (err: any) {
      console.error('Purchases initialization failed', err);
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
        <div className="py-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
            <ShoppingCart className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="mb-4 text-3xl font-bold text-gray-900">Welcome to Purchases Setup</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            Configure your purchasing workflow and accounting defaults before creating supplier transactions.
          </p>
          <div className="mx-auto grid max-w-3xl gap-6 text-left md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Calculator className="mb-3 h-8 w-8 text-primary-600" />
              <h3 className="mb-1 font-semibold text-gray-900">Workflow</h3>
              <p className="text-sm text-gray-600">Choose between invoice-only simplicity and a full operational flow.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <DollarSign className="mb-3 h-8 w-8 text-primary-600" />
              <h3 className="mb-1 font-semibold text-gray-900">Default Accounts</h3>
              <p className="text-sm text-gray-600">Set AP, optional expense fallback, and GRNI when perpetual accounting is enabled.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Settings className="mb-3 h-8 w-8 text-primary-600" />
              <h3 className="mb-1 font-semibold text-gray-900">Numbering</h3>
              <p className="text-sm text-gray-600">Configure prefixes and default payment terms for purchase documents.</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="mx-auto max-w-3xl space-y-4 py-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">Choose Purchasing Workflow</h2>
          <p className="mb-6 text-center text-gray-600">
            Workflow controls which purchase documents users see. Accounting mode is inherited from Inventory.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Inventory accounting mode: <span className="font-semibold">{getAccountingModeLabel(accountingMode)}</span>
          </div>

          <label className={`flex items-start gap-3 rounded-lg border bg-white p-5 ${simpleWorkflowDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${workflowMode === 'SIMPLE' ? 'border-primary-500' : 'border-gray-200 hover:border-primary-500'}`}>
            <input
              type="radio"
              name="purchase-workflow-mode"
              checked={workflowMode === 'SIMPLE'}
              onChange={() => setWorkflowMode('SIMPLE')}
              disabled={simpleWorkflowDisabled}
            />
            <div>
              <div className="font-semibold text-gray-900">Simple</div>
              <div className="text-sm text-gray-600">Show invoices and returns only. Purchase Orders and Goods Receipts stay hidden.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 rounded-lg border bg-white p-5 cursor-pointer ${workflowMode === 'OPERATIONAL' ? 'border-primary-500' : 'border-gray-200 hover:border-primary-500'}`}>
            <input
              type="radio"
              name="purchase-workflow-mode"
              checked={workflowMode === 'OPERATIONAL'}
              onChange={() => setWorkflowMode('OPERATIONAL')}
            />
            <div>
              <div className="font-semibold text-gray-900">Operational</div>
              <div className="text-sm text-gray-600">Expose Purchase Orders and Goods Receipts alongside invoices and returns.</div>
            </div>
          </label>

          {simpleWorkflowDisabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Perpetual accounting requires the operational workflow because Goods Receipts create inventory accounting.
            </div>
          )}

          {workflowMode === 'OPERATIONAL' ? (
            <div className="space-y-4 pt-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={allowDirectInvoicing}
                  onChange={(e) => setAllowDirectInvoicing(e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-gray-900">Allow Direct Invoicing</div>
                  <div className="text-sm text-gray-600">Allow vendor invoices without a Purchase Order or Goods Receipt path.</div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={requirePOForStockItems}
                  onChange={(e) => setRequirePOForStockItems(e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-gray-900">Require Purchase Orders for Stock Items</div>
                  <div className="text-sm text-gray-600">Force stock-item procurement to start from a Purchase Order.</div>
                </div>
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Simple workflow automatically enables direct invoicing and hides Purchase Orders and Goods Receipts from end users.
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="mx-auto max-w-3xl space-y-5 py-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">Default Accounts</h2>
          <p className="mb-4 text-center text-sm text-gray-600">
            Required purchase posting accounts must be configured before initialization.
          </p>

          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-bold text-gray-700">Default Accounts Payable</label>
              <AccountSelector
                value={defaultAPAccountId}
                onChange={(account: any) => setDefaultAPAccountId(account?.id || '')}
                accounts={liabilityAccounts}
                placeholder="Select AP liability account"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-gray-500">Primary vendor liability account. Usually Accounts Payable.</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-bold text-gray-700">Default Purchase Expense</label>
              <AccountSelector
                value={defaultPurchaseExpenseAccountId}
                onChange={(account: any) => setDefaultPurchaseExpenseAccountId(account?.id || '')}
                accounts={expenseAccounts}
                placeholder="Select expense account for non-stock purchases"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Optional fallback used for non-stock or service purchases when an item/category account is not set.
              </p>
            </div>

            {accountingMode === 'PERPETUAL' ? (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <label className="mb-2 block text-sm font-bold text-gray-700">Default GRNI Account</label>
                <AccountSelector
                  value={defaultGRNIAccountId}
                  onChange={(account: any) => setDefaultGRNIAccountId(account?.id || '')}
                  accounts={liabilityAccounts}
                  placeholder="Select GRNI liability account"
                  disabled={isLoading}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Required in perpetual mode. Goods Receipts credit this account before the Purchase Invoice clears it.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                <p className="mb-1 text-sm font-medium text-blue-700">Invoice-driven purchase accounting</p>
                <p className="text-sm text-blue-600/80">
                  Goods Receipts stay operational only. Purchase Invoices create the accounting effect.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
              <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                <Settings className="h-3.5 w-3.5 text-gray-400" />
                Related Inventory Accounts
              </h4>
              <div className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                Accounting mode: <span className="font-semibold">{getAccountingModeLabel(accountingMode)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-tight text-gray-400">Default Inventory Asset</span>
                <span className="mt-1 block truncate rounded border border-gray-100 bg-white px-2 py-1 text-sm font-medium text-gray-600">
                  {getAccountLabel(inventorySettings?.defaultInventoryAssetAccountId)}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="mx-auto max-w-3xl space-y-6 py-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">Defaults & Numbering</h2>
          <p className="mb-4 text-center text-gray-600">Set default payment terms and document prefixes.</p>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Default Payment Terms (Days)</label>
            <input
              type="number"
              min={0}
              value={defaultPaymentTermsDays}
              onChange={(e) => setDefaultPaymentTermsDays(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">PO Prefix</label>
              <input
                type="text"
                value={poNumberPrefix}
                onChange={(e) => setPoNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">GRN Prefix</label>
              <input
                type="text"
                value={grnNumberPrefix}
                onChange={(e) => setGrnNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">PI Prefix</label>
              <input
                type="text"
                value={piNumberPrefix}
                onChange={(e) => setPiNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">PR Prefix</label>
              <input
                type="text"
                value={prNumberPrefix}
                onChange={(e) => setPrNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-3xl space-y-6 py-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Review & Initialize</h2>
          <p className="text-gray-600">Review the configuration below and initialize the Purchases module.</p>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Workflow Mode</div>
              <div className="mt-1 font-semibold text-gray-900">{getWorkflowModeLabel(workflowMode)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Accounting Mode</div>
              <div className="mt-1 font-semibold text-gray-900">{getAccountingModeLabel(accountingMode)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Allow Direct Invoicing</div>
              <div className="mt-1 font-semibold text-gray-900">{workflowMode === 'SIMPLE' ? 'Yes' : allowDirectInvoicing ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Require PO For Stock Items</div>
              <div className="mt-1 font-semibold text-gray-900">{workflowMode === 'SIMPLE' ? 'No' : requirePOForStockItems ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Default AP Account</div>
              <div className="mt-1 font-semibold text-gray-900">{getAccountLabel(defaultAPAccountId)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Default Purchase Expense</div>
              <div className="mt-1 font-semibold text-gray-900">{getAccountLabel(defaultPurchaseExpenseAccountId)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Default GRNI Account</div>
              <div className="mt-1 font-semibold text-gray-900">
                {accountingMode === 'PERPETUAL' ? getAccountLabel(defaultGRNIAccountId) : 'Not Required'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Default Payment Terms</div>
              <div className="mt-1 font-semibold text-gray-900">{defaultPaymentTermsDays} days</div>
            </div>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Purchases Module Initialization</h1>
          <p className="text-lg text-gray-600">Set workflow, accounting defaults, and numbering for procurement.</p>
        </div>

        <div className="mb-8 flex items-center justify-center">
          {stepTitles.map((title, index) => (
            <React.Fragment key={title}>
              <div className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                    index <= currentStep ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="ml-3 hidden text-sm font-medium text-gray-700 md:block">{title}</div>
              </div>
              {index < stepTitles.length - 1 && (
                <div className={`mx-4 h-0.5 w-16 ${index < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="min-h-[540px] px-8 py-10">
            {isLoading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              content
            )}
          </div>

          {error && (
            <div className="border-t border-red-200 bg-red-50 px-8 py-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="border-t border-gray-100 bg-gray-50 px-8 py-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={currentStep === 0 || submitting}
                className="inline-flex items-center rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="mr-2 h-5 w-5" />
                Previous
              </button>

              {currentStep < stepTitles.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={submitting || isLoading}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="ml-2 h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={initialize}
                  disabled={submitting || isLoading}
                  className="inline-flex items-center rounded-lg bg-green-600 px-8 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Initialize Purchases Module
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseInitializationWizard;
