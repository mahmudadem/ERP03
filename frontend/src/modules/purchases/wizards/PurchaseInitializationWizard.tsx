import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query'; import { AlertTriangle, Calculator, CheckCircle, ChevronLeft, ChevronRight, DollarSign, FileCheck, Info, Settings, ShoppingCart} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { inventoryApi } from '../../../api/inventoryApi';
import { InitializePurchasesPayload, purchasesApi } from '../../../api/purchasesApi';
import { WorkflowMode } from '../../../api/salesApi';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
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
import { useTranslation } from "react-i18next";

interface PurchaseInitializationWizardProps {
  onComplete: () => void;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const stepTitles = ['Welcome', 'Workflow Mode', 'Default Accounts', 'Defaults & Numbering', 'Voucher Types', 'Review'];

const PurchaseInitializationWizard: React.FC<PurchaseInitializationWizardProps> = ({ onComplete }) => {
    const { t } = useTranslation('common');
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
  const [requirePOForStockItems, setRequirePOForStockItems] = useState(false);
  const [defaultAPAccountId, setDefaultAPAccountId] = useState('');
  const [defaultPurchaseExpenseAccountId, setDefaultPurchaseExpenseAccountId] = useState('');
  const [defaultGRNIAccountId, setDefaultGRNIAccountId] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [poNumberPrefix, setPoNumberPrefix] = useState('PO');
  const [grnNumberPrefix, setGrnNumberPrefix] = useState('GRN');
  const [piNumberPrefix, setPiNumberPrefix] = useState('PI');
  const [prNumberPrefix, setPrNumberPrefix] = useState('PR');
  // Voucher Type groups (each group = one abstract type with N form variants).
  // The wizard tracks selection by typeKey (e.g. "purchase_invoice"); on submit
  // we expand to template ids so every form variant of every selected type is
  // installed as a locked + inactive default.
  const [voucherTypeGroups, setVoucherTypeGroups] = useState<SystemVoucherTypeGroup[]>([]);
  const [selectedTypeKeys, setSelectedTypeKeys] = useState<string[]>([]);
  const [inventorySettings, setInventorySettings] = useState<{
    defaultInventoryAssetAccountId?: string;
    accountingMode?: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
    inventoryAccountingMethod?: 'PERIODIC' | 'PERPETUAL';
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingSettings(true);
        const [inventorySettingsResult, typeGroups] = await Promise.all([
          inventoryApi.getSettings().catch(() => null),
          loadSystemVoucherTypeGroups('PURCHASE'),
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
      if (accountingEnabled) {
        if (!defaultAPAccountId) return 'Default AP Account is required.';
        // GRNI is only used (and only shown) in PERPETUAL mode. In invoice-driven
        // mode the GRN posts no GL, so requiring GRNI here would deadlock the
        // wizard (the field isn't rendered) for invoice-driven + OPERATIONAL tenants.
        if (workflowMode === 'OPERATIONAL' && accountingMode === 'PERPETUAL' && !defaultGRNIAccountId) return 'Default GRNI Account is required for operational workflow.';
      }
      if (!defaultPaymentTermsDays || defaultPaymentTermsDays <= 0) return 'Payment terms must be greater than 0.';
    }

    if (currentStep === 3 && (Number.isNaN(defaultPaymentTermsDays) || defaultPaymentTermsDays < 0)) {
      return 'Payment terms must be zero or greater.';
    }

    return null;
  }, [accountingEnabled, accountingMode, currentStep, defaultAPAccountId, defaultGRNIAccountId, defaultPaymentTermsDays, workflowMode]);

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

      await purchasesApi.initializePurchases({
        workflowMode,
        defaultAPAccountId: accountingEnabled ? defaultAPAccountId : undefined,
        // Only send GRNI when actually set (perpetual mode). An empty string is
        // rejected by the optional-string validator, so coerce '' → undefined.
        defaultGRNIAccountId: accountingEnabled && workflowMode === 'OPERATIONAL' ? (defaultGRNIAccountId || undefined) : undefined,
        defaultPurchaseExpenseAccountId: accountingEnabled ? defaultPurchaseExpenseAccountId : undefined,
        defaultPaymentTermsDays,
        allowDirectInvoicing: workflowMode === 'SIMPLE' ? true : allowDirectInvoicing,
        requirePOForStockItems: workflowMode === 'SIMPLE' ? false : requirePOForStockItems,
        poNumberPrefix: poNumberPrefix || 'PO',
        grnNumberPrefix: grnNumberPrefix || 'GRN',
        piNumberPrefix: piNumberPrefix || 'PI',
        prNumberPrefix: prNumberPrefix || 'PR',
        selectedVoucherTypes: selectedTemplateIds,
      });
      emitCompanyModulesRefresh({ companyId, moduleCode: 'purchase' });
      await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
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
          <h2 className="mb-4 text-3xl font-bold text-gray-900">{t(`Welcome to Purchases Setup`)}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            Configure your purchasing workflow and accounting defaults before creating supplier transactions.
          </p>
          <div className="mx-auto grid max-w-3xl gap-6 text-left md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Calculator className="mb-3 h-8 w-8 text-primary-600" />
              <h3 className="mb-1 font-semibold text-gray-900">{t(`Workflow`)}</h3>
              <p className="text-sm text-gray-600">{t(`Choose between invoice-only simplicity and a full operational flow.`)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <DollarSign className="mb-3 h-8 w-8 text-primary-600" />
              <h3 className="mb-1 font-semibold text-gray-900">{t(`Default Accounts`)}</h3>
              <p className="text-sm text-gray-600">{t(`Set AP, optional expense fallback, and GRNI when perpetual accounting is enabled.`)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Settings className="mb-3 h-8 w-8 text-primary-600" />
              <h3 className="mb-1 font-semibold text-gray-900">{t(`Numbering`)}</h3>
              <p className="text-sm text-gray-600">{t(`Configure prefixes and default payment terms for purchase documents.`)}</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="mx-auto max-w-3xl space-y-4 py-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">{t(`Choose Purchasing Workflow`)}</h2>
          <p className="mb-6 text-center text-gray-600">
            Workflow controls which purchase documents users see. Accounting mode is inherited from Inventory.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {t(`Inventory accounting mode:`)} <span className="font-semibold">{getAccountingModeLabel(accountingMode)}</span>
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
              <div className="font-semibold text-gray-900">{t(`Simple`)}</div>
              <div className="text-sm text-gray-600">{t(`Show invoices and returns only. Purchase Orders and Goods Receipts stay hidden.`)}</div>
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
              <div className="font-semibold text-gray-900">{t(`Operational`)}</div>
              <div className="text-sm text-gray-600">{t(`Expose Purchase Orders and Goods Receipts alongside invoices and returns.`)}</div>
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
                  <div className="font-semibold text-gray-900">{t(`Allow Direct Invoicing`)}</div>
                  <div className="text-sm text-gray-600">{t(`Allow vendor invoices without a Purchase Order or Goods Receipt path.`)}</div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={requirePOForStockItems}
                  onChange={(e) => setRequirePOForStockItems(e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-gray-900">{t(`Require Purchase Orders for Stock Items`)}</div>
                  <div className="text-sm text-gray-600">{t(`Force stock-item procurement to start from a Purchase Order.`)}</div>
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
      if (!accountingEnabled) {
        return (
          <div className="py-6 max-w-2xl mx-auto space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">{t(`Account Mapping`)}</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-amber-900">{t(`Accounting Not Enabled`)}</div>
                  <div className="text-sm text-amber-800 mt-1">{t(`Purchase operations will track documents and quantities but will NOT create financial/GL postings.`)}</div>
                  <div className="text-sm text-amber-700 mt-2">{t(`To enable financial impact, activate the Accounting module from Company Admin → Modules, then complete the Accounting setup.`)}</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">{t(`Account mapping (AP, GRNI, expense accounts) will be configured when Accounting is enabled. You can set these later from Purchase Settings.`)}</p>
          </div>
        );
      }

      return (
        <div className="mx-auto max-w-3xl space-y-5 py-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">{t(`Default Accounts`)}</h2>
          <p className="mb-4 text-center text-sm text-gray-600">
            Required purchase posting accounts must be configured before initialization.
          </p>

          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-bold text-gray-700">{t(`Default Accounts Payable`)}</label>
              <AccountSelector
                value={defaultAPAccountId}
                onChange={(account: any) => setDefaultAPAccountId(account?.id || '')}
                accounts={liabilityAccounts}
                placeholder="Select AP liability account"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-gray-500">{t(`Primary vendor liability account. Usually Accounts Payable.`)}</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-bold text-gray-700">{t(`Default Purchase Expense`)}</label>
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
                <label className="mb-2 block text-sm font-bold text-gray-700">{t(`Default GRNI Account`)}</label>
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
                <p className="mb-1 text-sm font-medium text-blue-700">{t(`Invoice-driven purchase accounting`)}</p>
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
                {t(`Accounting mode:`)} <span className="font-semibold">{getAccountingModeLabel(accountingMode)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-tight text-gray-400">{t(`Default Inventory Asset`)}</span>
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
          <h2 className="text-center text-2xl font-bold text-gray-900">{t(`Defaults & Numbering`)}</h2>
          <p className="mb-4 text-center text-gray-600">{t(`Set default payment terms and document prefixes.`)}</p>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-700">{t(`Default Payment Terms (Days)`)}</label>
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
              <label className="mb-2 block text-sm font-semibold text-gray-700">{t(`PO Prefix`)}</label>
              <input
                type="text"
                value={poNumberPrefix}
                onChange={(e) => setPoNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">{t(`GRN Prefix`)}</label>
              <input
                type="text"
                value={grnNumberPrefix}
                onChange={(e) => setGrnNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">{t(`PI Prefix`)}</label>
              <input
                type="text"
                value={piNumberPrefix}
                onChange={(e) => setPiNumberPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">{t(`PR Prefix`)}</label>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t(`Select Voucher Types`)}</h2>
          <p className="text-gray-600 mb-6 text-center">
            Pick which purchase document types to install. Each type comes with one or more default form variants &mdash; you'll activate or customize them next.
          </p>

          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-600">
              {selectedTypeKeys.length} {t(`of`)} {voucherTypeGroups.length} types selected
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
                <p className="text-gray-600 font-medium">{t(`No Purchase voucher types available`)}</p>
                <p className="text-sm text-gray-500 mt-1">
                  The system catalog has no Purchase templates yet. Contact your administrator.
                </p>
              </div>
            ) : (
              voucherTypeGroups.map((group) => {
                const isSelected = selectedTypeKeys.includes(group.typeKey);
                const formCount = group.forms.length;
                // Render the persona label (e.g. "Direct") of each form so the
                // user can see what variants come bundled with the type.
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
                            {formCount} {t(`default form`)}{formCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {variantLabels.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {t(`Variants:`)} {variantLabels.join(' · ')}
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
                <p className="font-semibold">{t(`These install as locked, inactive default templates.`)}</p>
                <p>
                  The schemas are available immediately, but no sidebar entries appear until you open
                  <span className="font-semibold"> {t(`Tools &rarr; Forms Designer`)}</span> and either:
                </p>
                <ul className="list-disc list-inside ml-1 space-y-0.5">
                  <li><span className="font-semibold">{t(`Activate`)}</span> {t(`a default form to use it as-is, or`)}</li>
                  <li><span className="font-semibold">{t(`Clone`)}</span> {t(`it to create an editable variant.`)}</li>
                </ul>
              </div>
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
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{t(`Review & Initialize`)}</h2>
          <p className="text-gray-600">{t(`Review the configuration below and initialize the Purchases module.`)}</p>
        </div>

        {!accountingEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t(`Accounting is not enabled. This initialization will set up purchase operations only — no financial/GL postings will be created.`)}</span>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Workflow Mode`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{getWorkflowModeLabel(workflowMode)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Accounting Mode`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{getAccountingModeLabel(accountingMode)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Allow Direct Invoicing`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{workflowMode === 'SIMPLE' ? 'Yes' : allowDirectInvoicing ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Require PO For Stock Items`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{workflowMode === 'SIMPLE' ? 'No' : requirePOForStockItems ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Default AP Account`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{getAccountLabel(defaultAPAccountId)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Default Purchase Expense`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{getAccountLabel(defaultPurchaseExpenseAccountId)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Default GRNI Account`)}</div>
              <div className="mt-1 font-semibold text-gray-900">
                {accountingMode === 'PERPETUAL' ? getAccountLabel(defaultGRNIAccountId) : 'Not Required'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Default Payment Terms`)}</div>
              <div className="mt-1 font-semibold text-gray-900">{defaultPaymentTermsDays} {t(`days`)}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">{t(`Selected Voucher Types`)}</div>
              {selectedTypeKeys.length === 0 ? (
                <div className="mt-1 text-sm text-gray-500">{t(`None selected. You can add them later from Settings.`)}</div>
              ) : (
                <ul className="mt-1 space-y-1">
                  {selectedTypeKeys.map((typeKey) => {
                    const group = voucherTypeGroups.find((g) => g.typeKey === typeKey);
                    return group ? (
                      <li key={typeKey} className="flex items-center gap-2 text-sm text-gray-900">
                        <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        <span className="font-medium">{group.name}</span>
                        <span className="text-xs text-gray-500">
                          ({group.forms.length} {t(`default form`)}{group.forms.length !== 1 ? 's' : ''})
                        </span>
                      </li>
                    ) : null;
                  })}
                  <li className="text-xs text-gray-600 mt-1">
                    {t(`Total:`)} {selectedTypeKeys.length} {t(`type`)}{selectedTypeKeys.length !== 1 ? 's' : ''},{' '}
                    {voucherTypeGroups
                      .filter((g) => selectedTypeKeys.includes(g.typeKey))
                      .reduce((sum, g) => sum + g.forms.length, 0)}{' '}
                    {t(`form`)}{' '}variants will install as locked defaults
                  </li>
                </ul>
              )}
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
          <h1 className="mb-2 text-4xl font-bold text-gray-900">{t(`Purchases Module Initialization`)}</h1>
          <p className="text-lg text-gray-600">{t(`Set workflow, accounting defaults, and numbering for procurement.`)}</p>
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
                <Spinner size="lg" />
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
                      <Spinner className="mr-2" />
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
