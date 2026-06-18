import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query'; import { AlertTriangle, Calculator, CheckCircle, ChevronLeft, ChevronRight, DollarSign, FileCheck, Info, Settings, ShoppingCart} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { useAccounts } from '../../../context/AccountsContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { inventoryApi } from '../../../api/inventoryApi';
import { InitializeSalesPayload, salesApi, WorkflowMode } from '../../../api/salesApi';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import {
  getAccountingModeLabel,
  getWorkflowModeLabel,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import {
  loadSystemVoucherTypeGroups,
  SystemVoucherTypeGroup,
} from '../../accounting/services/voucherTypesService';

interface SalesInitializationWizardProps {
  onComplete: () => void;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const stepTitles = ['Welcome', 'Workflow Mode', 'Default Accounts', 'Defaults & Numbering', 'Voucher Types', 'Review'];

const SalesInitializationWizard: React.FC<SalesInitializationWizardProps> = ({ onComplete }) => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyAccess();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { validAccounts, isLoading: loadingAccountsContext, getAccountById, refreshAccounts } = useAccounts();
  const [loadingSettings, setLoadingSettings] = useState(true);
  const { isModuleInitialized, loading: loadingModules } = useCompanyModules();
  const accountingEnabled = isModuleInitialized('accounting');

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('SIMPLE');
  const [allowDirectInvoicing, setAllowDirectInvoicing] = useState(true);
  const [requireSOForStockItems, setRequireSOForStockItems] = useState(false);
  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [soNumberPrefix, setSoNumberPrefix] = useState('SO');
  const [dnNumberPrefix, setDnNumberPrefix] = useState('DN');
  const [siNumberPrefix, setSiNumberPrefix] = useState('SI');
  const [srNumberPrefix, setSrNumberPrefix] = useState('SR');
  // Voucher Type groups (each group = one abstract type with N form variants).
  // The wizard tracks selection by typeKey (e.g. "sales_invoice"); on submit
  // we expand to template ids so every form variant of every selected type is
  // installed as a locked + inactive default.
  const [voucherTypeGroups, setVoucherTypeGroups] = useState<SystemVoucherTypeGroup[]>([]);
  const [selectedTypeKeys, setSelectedTypeKeys] = useState<string[]>([]);
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
        const [inventorySettingsResult, typeGroups] = await Promise.all([
          inventoryApi.getSettings().catch(() => null),
          loadSystemVoucherTypeGroups('SALES'),
        ]);
        const invSettingsData = inventorySettingsResult
          ? unwrap<any>(inventorySettingsResult)?.data ?? unwrap<any>(inventorySettingsResult)
          : null;

        setInventorySettings(invSettingsData);
        if (resolveInventoryAccountingMode(invSettingsData) === 'PERPETUAL') {
          setWorkflowMode('OPERATIONAL');
        }

        setVoucherTypeGroups(typeGroups);
        // Default-select recommended types, or every type if none flagged.
        const recommended = typeGroups.filter((g) => g.isRecommended).map((g) => g.typeKey);
        setSelectedTypeKeys(recommended.length > 0 ? recommended : typeGroups.map((g) => g.typeKey));
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
    if (currentStep === 2) {
      if (accountingEnabled) {
        if (!defaultRevenueAccountId) return 'Default Revenue Account is required.';
      }
      if (!defaultPaymentTermsDays || defaultPaymentTermsDays <= 0) return 'Payment terms must be greater than 0.';
    }

    if (currentStep === 3 && (Number.isNaN(defaultPaymentTermsDays) || defaultPaymentTermsDays < 0)) {
      return 'Payment terms must be zero or greater.';
    }

    return null;
  }, [accountingEnabled, currentStep, defaultPaymentTermsDays, defaultRevenueAccountId]);

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

      // Expand each selected type key into every template id (form variant) for
      // that type. The backend sync still takes template ids; the wizard just
      // bundles "pick one type, install all its forms" at the call site.
      const selectedTemplateIds = voucherTypeGroups
        .filter((g) => selectedTypeKeys.includes(g.typeKey))
        .flatMap((g) => g.forms.map((f) => f.id));

      await salesApi.initializeSales({
        workflowMode,
        defaultRevenueAccountId: accountingEnabled ? defaultRevenueAccountId : undefined,
        defaultPaymentTermsDays,
        allowDirectInvoicing: workflowMode === 'SIMPLE' ? true : allowDirectInvoicing,
        requireSOForStockItems: workflowMode === 'SIMPLE' ? false : requireSOForStockItems,
        soNumberPrefix: soNumberPrefix || 'SO',
        dnNumberPrefix: dnNumberPrefix || 'DN',
        siNumberPrefix: siNumberPrefix || 'SI',
        srNumberPrefix: srNumberPrefix || 'SR',
        selectedVoucherTypes: selectedTemplateIds,
      });
      emitCompanyModulesRefresh({ companyId, moduleCode: 'sales' });
      await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
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
      if (!accountingEnabled) {
        return (
          <div className="py-6 max-w-2xl mx-auto space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Account Mapping</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-amber-900">Accounting Not Enabled</div>
                  <div className="text-sm text-amber-800 mt-1">Sales operations will track documents and quantities but will NOT create financial/GL postings.</div>
                  <div className="text-sm text-amber-700 mt-2">To enable financial impact, activate the Accounting module from Company Admin → Modules, then complete the Accounting setup.</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">Account mapping (Revenue, AR, COGS accounts) will be configured when Accounting is enabled. You can set these later from Sales Settings.</p>
          </div>
        );
      }

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

    if (currentStep === 4) {
      const toggleType = (typeKey: string) => {
        setSelectedTypeKeys((prev) =>
          prev.includes(typeKey) ? prev.filter((entry) => entry !== typeKey) : [...prev, typeKey]
        );
      };
      const selectAll = () => setSelectedTypeKeys(voucherTypeGroups.map((g) => g.typeKey));
      const clearAll = () => setSelectedTypeKeys([]);

      return (
        <div className="py-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Select Voucher Types</h2>
          <p className="text-gray-600 mb-6 text-center">
            Pick which sales document types to install. Each type comes with one or more default form variants &mdash; you'll activate or customize them next.
          </p>

          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-600">
              {selectedTypeKeys.length} of {voucherTypeGroups.length} types selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded transition"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {voucherTypeGroups.length === 0 ? (
              <div className="col-span-2 text-center py-12">
                <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No Sales voucher types available</p>
                <p className="text-sm text-gray-500 mt-1">
                  The system catalog has no Sales templates yet. Contact your administrator.
                </p>
              </div>
            ) : (
              voucherTypeGroups.map((group) => {
                const isSelected = selectedTypeKeys.includes(group.typeKey);
                const formCount = group.forms.length;
                const variantLabels = group.forms
                  .map((f) => {
                    if (f.persona) return f.persona.charAt(0).toUpperCase() + f.persona.slice(1);
                    const match = f.name.match(/\(([^)]+)\)/);
                    return match ? match[1] : null;
                  })
                  .filter(Boolean) as string[];
                return (
                  <button
                    type="button"
                    key={group.typeKey}
                    onClick={() => toggleType(group.typeKey)}
                    className={`p-5 rounded-lg border-2 transition-all text-left hover:border-primary-500 ${
                      isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                          {group.isRecommended && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Recommended
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            {formCount} default form{formCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {variantLabels.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Variants: {variantLabels.join(' · ')}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">These install as locked, inactive default templates.</p>
                <p>
                  The schemas are available immediately, but no sidebar entries appear until you open
                  <span className="font-semibold"> Tools &rarr; Forms Designer</span> and either:
                </p>
                <ul className="list-disc list-inside ml-1 space-y-0.5">
                  <li><span className="font-semibold">Activate</span> a default form to use it as-is, or</li>
                  <li><span className="font-semibold">Clone</span> it to create an editable variant.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="py-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Review & Confirm</h2>
        <p className="text-gray-600 mb-6 text-center">Confirm your configuration before initializing Sales.</p>

        {!accountingEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Accounting is not enabled. This initialization will set up sales operations only — no financial/GL postings will be created.</span>
            </div>
          </div>
        )}

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

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm text-gray-600 mb-2">Selected Voucher Types</h3>
            {selectedTypeKeys.length === 0 ? (
              <p className="text-sm text-gray-500">No voucher types selected. You can add them later from Settings.</p>
            ) : (
              <ul className="space-y-1">
                {selectedTypeKeys.map((typeKey) => {
                  const group = voucherTypeGroups.find((g) => g.typeKey === typeKey);
                  return group ? (
                    <li key={typeKey} className="flex items-center gap-2 text-sm text-gray-900">
                      <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      <span className="font-medium">{group.name}</span>
                      <span className="text-xs text-gray-500">
                        ({group.forms.length} default form{group.forms.length !== 1 ? 's' : ''})
                      </span>
                    </li>
                  ) : null;
                })}
                <li className="text-sm text-gray-600 mt-2">
                  Total: {selectedTypeKeys.length} type{selectedTypeKeys.length !== 1 ? 's' : ''},{' '}
                  {voucherTypeGroups
                    .filter((g) => selectedTypeKeys.includes(g.typeKey))
                    .reduce((sum, g) => sum + g.forms.length, 0)}{' '}
                  form variants will install as locked defaults
                </li>
              </ul>
            )}
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
                  <Spinner size="sm" />
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
