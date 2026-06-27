import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query'; import { AlertTriangle, Box, CheckCircle2, ChevronLeft, ChevronRight, Info, Settings, Warehouse, Wand2} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { inventoryApi } from '../../../api/inventoryApi';
import { Account, useAccounts } from '../../../context/AccountsContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { getAccountingModeLabel } from '../../../utils/documentPolicy';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { useTranslation } from "react-i18next";

interface InventoryInitializationWizardProps {
  onComplete: () => void;
}

const stepTitles = ['Welcome', 'Accounting Mode', 'Default Warehouse', 'Inventory Settings', 'Confirm & Initialize'];

const accountLabel = (account: Account): string =>
  `${account.code} - ${account.name}`;

export const InventoryInitializationWizard: React.FC<InventoryInitializationWizardProps> = ({ onComplete }) => {
    const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { companyId } = useCompanyAccess();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const { isModuleInitialized, loading: loadingModules } = useCompanyModules();
  const accountingEnabled = isModuleInitialized('accounting');

  const [defaultWarehouseName, setDefaultWarehouseName] = useState('Main Warehouse');
  const [defaultWarehouseCode, setDefaultWarehouseCode] = useState('MAIN');
  const [defaultWarehouseAddress, setDefaultWarehouseAddress] = useState('');

  const [accountingMode, setAccountingMode] = useState<'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL'>('INVOICE_DRIVEN');
  const [defaultCostCurrency, setDefaultCostCurrency] = useState('');
  const [defaultInventoryAssetAccountId, setDefaultInventoryAssetAccountId] = useState('');
  const [defaultCOGSAccountId, setDefaultCOGSAccountId] = useState('');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [autoGenerateItemCode, setAutoGenerateItemCode] = useState(false);
  const [itemCodePrefix, setItemCodePrefix] = useState('ITM');
  const [itemCodeNextSeq, setItemCodeNextSeq] = useState(1);

  const inventoryAssetAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          String(account.accountRole || '').toUpperCase() === 'POSTING' &&
          String(account.classification || '').toUpperCase() === 'ASSET' &&
          String(account.status || '').toUpperCase() === 'ACTIVE' &&
          !account.hasChildren
      ),
    [accounts]
  );

  const cogsAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          String(account.accountRole || '').toUpperCase() === 'POSTING' &&
          String(account.classification || '').toUpperCase() === 'EXPENSE' &&
          String(account.status || '').toUpperCase() === 'ACTIVE' &&
          !account.hasChildren
      ),
    [accounts]
  );

  const selectedInventoryAssetAccount = useMemo(
    () => inventoryAssetAccounts.find((account) => account.id === defaultInventoryAssetAccountId),
    [defaultInventoryAssetAccountId, inventoryAssetAccounts]
  );

  const selectedCOGSAccount = useMemo(
    () => accounts.find((account) => account.id === defaultCOGSAccountId),
    [defaultCOGSAccountId, accounts]
  );

  const stepError = useMemo(() => {
    if (currentStep === 2) {
      if (!defaultWarehouseName.trim()) return 'Warehouse name is required.';
      if (!defaultWarehouseCode.trim()) return 'Warehouse code is required.';
    }

    if (currentStep === 3) {
      if (accountingEnabled && accountingMode === 'PERPETUAL') {
        if (!defaultInventoryAssetAccountId) return 'Default Inventory Asset Account is required.';
      }
      if (autoGenerateItemCode) {
        if (itemCodeNextSeq <= 0 || Number.isNaN(itemCodeNextSeq)) {
          return 'Starting number must be greater than 0.';
        }
      }
    }

    return null;
  }, [
    autoGenerateItemCode,
    currentStep,
    defaultInventoryAssetAccountId,
    defaultCOGSAccountId,
    defaultWarehouseCode,
    defaultWarehouseName,
    accountingMode,
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
        accountingMode: accountingEnabled ? accountingMode : 'INVOICE_DRIVEN',
        inventoryAccountingMethod: accountingEnabled ? (accountingMode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC') : 'PERIODIC',
        defaultWarehouseName: defaultWarehouseName.trim(),
        defaultWarehouseCode: defaultWarehouseCode.trim(),
        defaultInventoryAssetAccountId: accountingEnabled ? (defaultInventoryAssetAccountId || undefined) : undefined,
        defaultCOGSAccountId: accountingEnabled ? (defaultCOGSAccountId || undefined) : undefined,
        defaultCostCurrency: defaultCostCurrency.trim() || undefined,
        allowNegativeStock,
        autoGenerateItemCode,
        itemCodePrefix: autoGenerateItemCode ? itemCodePrefix.trim() || undefined : undefined,
        itemCodeNextSeq: autoGenerateItemCode ? itemCodeNextSeq : undefined,
      });

      emitCompanyModulesRefresh({ companyId, moduleCode: 'inventory' });
      await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
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
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t(`Welcome to Inventory Setup`)}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Complete this guided wizard to create your first warehouse and baseline inventory settings.
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Warehouse className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">{t(`Warehouse`)}</h3>
              <p className="text-sm text-gray-600">{t(`Define your default warehouse for stock operations.`)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Settings className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">{t(`Inventory Settings`)}</h3>
              <p className="text-sm text-gray-600">{t(`Set cost currency and negative stock policy.`)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Wand2 className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">{t(`Item Code Rules`)}</h3>
              <p className="text-sm text-gray-600">{t(`Optionally auto-generate item codes.`)}</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      if (!accountingEnabled) {
        return (
          <div className="py-6 max-w-2xl mx-auto space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">{t(`Accounting Integration`)}</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-amber-900">{t(`Accounting Not Enabled`)}</div>
                  <div className="text-sm text-amber-800 mt-1">{t(`Inventory operations will track quantities and costs but will NOT create financial/GL postings.`)}</div>
                  <div className="text-sm text-amber-700 mt-2">{t(`To enable financial impact, activate the Accounting module from Company Admin → Modules, then complete the Accounting setup.`)}</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">{t(`The accounting mode selection is available once Accounting is enabled. You can configure it later from Inventory Settings.`)}</p>
          </div>
        );
      }

      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">{t(`Inventory Accounting Mode`)}</h2>
          <p className="text-sm text-gray-600">{t(`Choose when stock-related accounting should be recognized.`)}</p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input
              type="radio"
              name="inventory-accounting-mode"
              checked={accountingMode === 'PERIODIC'}
              onChange={() => setAccountingMode('PERIODIC')}
            />
            <div>
              <div className="font-semibold text-gray-900">{t(`Periodic`)}</div>
              <div className="text-sm text-gray-600">{t(`Invoices post Sales and Purchases only. Stock quantities still move, but inventory and COGS stay out of the ledger until reporting time.`)}</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input
              type="radio"
              name="inventory-accounting-mode"
              checked={accountingMode === 'INVOICE_DRIVEN'}
              onChange={() => setAccountingMode('INVOICE_DRIVEN')}
            />
            <div>
              <div className="font-semibold text-gray-900">{t(`Invoice-driven`)}</div>
              <div className="text-sm text-gray-600">{t(`Operational stock documents stay non-financial. Sales and purchase invoices create the accounting effect.`)}</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input
              type="radio"
              name="inventory-accounting-mode"
              checked={accountingMode === 'PERPETUAL'}
              onChange={() => setAccountingMode('PERPETUAL')}
            />
            <div>
              <div className="font-semibold text-gray-900">{t(`Perpetual`)}</div>
              <div className="text-sm text-gray-600">{t(`Delivery and receipt posting can create real-time inventory and COGS accounting.`)}</div>
            </div>
          </label>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">{t(`Default Warehouse`)}</h2>
          <p className="text-sm text-gray-600">{t(`Create the default warehouse used for opening stock and movements.`)}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Name`)}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Code`)}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Address (Optional)`)}</label>
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

    if (currentStep === 3) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">{t(`Inventory Settings`)}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default Cost Currency`)}</label>
            <input
              type="text"
              value={defaultCostCurrency}
              onChange={(e) => setDefaultCostCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Leave blank to use company base currency"
            />
          </div>

          {!accountingEnabled ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-700">{t(`Account Mapping`)}</div>
                  <div className="text-xs text-gray-500 mt-1">{t(`Account mapping will be configured when Accounting is enabled. You can set Inventory Asset and COGS accounts later from Inventory Settings.`)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default Inventory Asset Account`)}</label>
                <AccountSelector
                  value={defaultInventoryAssetAccountId}
                  onChange={(account: any) => setDefaultInventoryAssetAccountId(account?.id || '')}
                  placeholder="Select inventory asset account"
                  disabled={loadingAccounts}
                  accounts={inventoryAssetAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-600">
                  {accountingMode === 'PERPETUAL'
                    ? 'Required for perpetual inventory. This is the balance sheet account that holds the value of stock on hand.'
                    : accountingMode === 'PERIODIC'
                      ? 'Recommended for periodic opening stock and report-time goods inventory. Periodic documents do not post live inventory or COGS.'
                      : 'Recommended fallback for invoice-driven stock purchases and inventory recognition.'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Type an account code or name, then press Enter or Alt+Down to search. If no match exists, you can create a new account from the selector dialog.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default COGS Account`)}</label>
                <AccountSelector
                  value={defaultCOGSAccountId}
                  onChange={(account: any) => setDefaultCOGSAccountId(account?.id || '')}
                  placeholder="Select COGS account"
                  disabled={loadingAccounts}
                  accounts={cogsAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-600">
                  Optional fallback. Used when sold stock needs a cost posting and the item or category does not have its own COGS account yet.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Use the same selector behavior here: type, press Enter or Alt+Down to search, and create the account if it does not exist yet.
                </p>
              </div>
            </div>
          )}

          <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-gray-900">{t(`Allow Negative Stock`)}</div>
              <div className="text-xs text-gray-600">{t(`When enabled, stock can go below zero.`)}</div>
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
              <div className="text-sm font-semibold text-gray-900">{t(`Auto-generate Item Codes`)}</div>
              <div className="text-xs text-gray-600">{t(`Generate item codes based on prefix and sequence.`)}</div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Prefix`)}</label>
                <input
                  type="text"
                  value={itemCodePrefix}
                  onChange={(e) => setItemCodePrefix(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="ITM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Starting Number`)}</label>
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
        <h2 className="text-2xl font-bold text-gray-900">{t(`Confirm & Initialize`)}</h2>
        <p className="text-sm text-gray-600">{t(`Review your setup before creating inventory defaults.`)}</p>

        {!accountingEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t(`Accounting is not enabled. This initialization will set up inventory operations only — no financial/GL postings will be created.`)}</span>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Accounting Method:`)}</span>{' '}
            <span className="text-gray-700">{getAccountingModeLabel(accountingMode)}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Warehouse:`)}</span>{' '}
            <span className="text-gray-700">{defaultWarehouseName} ({defaultWarehouseCode})</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Address:`)}</span>{' '}
            <span className="text-gray-700">{defaultWarehouseAddress || 'Not provided'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Default Cost Currency:`)}</span>{' '}
            <span className="text-gray-700">{defaultCostCurrency || 'Company base currency'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Default Inventory Asset Account:`)}</span>{' '}
            <span className="text-gray-700">
              {selectedInventoryAssetAccount ? accountLabel(selectedInventoryAssetAccount) : (accountingMode === 'PERPETUAL' ? 'Not selected' : 'Not selected (recommended)')}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Default COGS Account:`)}</span>{' '}
            <span className="text-gray-700">
              {selectedCOGSAccount ? accountLabel(selectedCOGSAccount) : 'Not selected (optional)'}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Allow Negative Stock:`)}</span>{' '}
            <span className="text-gray-700">{allowNegativeStock ? 'Yes' : 'No'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Auto-generate Item Codes:`)}</span>{' '}
            <span className="text-gray-700">{autoGenerateItemCode ? 'Yes' : 'No'}</span>
          </div>
          {autoGenerateItemCode && (
            <div className="text-sm">
              <span className="font-semibold text-gray-900">{t(`Item Code Rule:`)}</span>{' '}
              <span className="text-gray-700">{itemCodePrefix || '(no prefix)'} {t(`/ next #`)}{itemCodeNextSeq}</span>
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
              {t(`Step`)} {currentStep + 1} {t(`of`)} {stepTitles.length}
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
          <div className="flex items-center gap-3">
            {currentStep < stepTitles.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={initialize}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 transition"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Start Inventory
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
