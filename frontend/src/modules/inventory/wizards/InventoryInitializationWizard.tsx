import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query'; import { AlertTriangle, Box, Info, Settings, Warehouse, Wand2} from 'lucide-react';
import { ModuleSetupWizardShell } from '../../../components/shared/ModuleSetupWizardShell';
import { inventoryApi } from '../../../api/inventoryApi';
import { Account, useAccounts } from '../../../context/AccountsContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { useCompanyModules } from '../../../hooks/useCompanyModules';

interface InventoryInitializationWizardProps {
  onComplete?: () => void;
}

const stepTitleKeys = ['welcome', 'accountingMode', 'warehouse', 'settings', 'confirm'] as const;

const accountLabel = (account: Account): string =>
  `${account.code} - ${account.name}`;

export const InventoryInitializationWizard: React.FC<InventoryInitializationWizardProps> = ({ onComplete }) => {
  const { t } = useTranslation('inventory');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyAccess();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const { isModuleInitialized, loading: loadingModules } = useCompanyModules();
  const accountingEnabled = isModuleInitialized('accounting');

  const [defaultWarehouseName, setDefaultWarehouseName] = useState(() => t('initializationWizard.warehouse.defaultName'));
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
      if (!defaultWarehouseName.trim()) return t('initializationWizard.errors.warehouseNameRequired');
      if (!defaultWarehouseCode.trim()) return t('initializationWizard.errors.warehouseCodeRequired');
    }

    if (currentStep === 3) {
      if (accountingEnabled && accountingMode === 'PERPETUAL') {
        if (!defaultInventoryAssetAccountId) return t('initializationWizard.errors.inventoryAssetRequired');
      }
      if (autoGenerateItemCode) {
        if (itemCodeNextSeq <= 0 || Number.isNaN(itemCodeNextSeq)) {
          return t('initializationWizard.errors.startingNumber');
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
    t,
  ]);

  const goNext = () => {
    if (stepError) {
      setError(stepError);
      return;
    }

    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, stepTitleKeys.length - 1));
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
      toast.success(t('initializationWizard.messages.success'));
      if (onComplete) {
        onComplete();
      } else {
        navigate('/inventory', { replace: true });
      }
    } catch (err: any) {
      console.error('Inventory initialization failed', err);
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        t('initializationWizard.errors.initialize');
      setError(message);
      toast.error(message);
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
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('initializationWizard.welcome.title')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            {t('initializationWizard.welcome.description')}
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto text-start">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Warehouse className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">{t('initializationWizard.welcome.warehouseTitle')}</h3>
              <p className="text-sm text-gray-600">{t('initializationWizard.welcome.warehouseDescription')}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Settings className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">{t('initializationWizard.welcome.settingsTitle')}</h3>
              <p className="text-sm text-gray-600">{t('initializationWizard.welcome.settingsDescription')}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Wand2 className="w-7 h-7 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900">{t('initializationWizard.welcome.itemCodesTitle')}</h3>
              <p className="text-sm text-gray-600">{t('initializationWizard.welcome.itemCodesDescription')}</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      if (!accountingEnabled) {
        return (
          <div className="py-6 max-w-2xl mx-auto space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">{t('initializationWizard.accounting.integrationTitle')}</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-amber-900">{t('initializationWizard.accounting.notEnabledTitle')}</div>
                  <div className="text-sm text-amber-800 mt-1">{t('initializationWizard.accounting.notEnabledDescription')}</div>
                  <div className="text-sm text-amber-700 mt-2">{t('initializationWizard.accounting.enableInstructions')}</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">{t('initializationWizard.accounting.availableLater')}</p>
          </div>
        );
      }

      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">{t('initializationWizard.accounting.modeTitle')}</h2>
          <p className="text-sm text-gray-600">{t('initializationWizard.accounting.modeDescription')}</p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input
              type="radio"
              name="inventory-accounting-mode"
              checked={accountingMode === 'PERIODIC'}
              onChange={() => setAccountingMode('PERIODIC')}
            />
            <div>
              <div className="font-semibold text-gray-900">{t('initializationWizard.accounting.modes.periodic.title')}</div>
              <div className="text-sm text-gray-600">{t('initializationWizard.accounting.modes.periodic.description')}</div>
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
              <div className="font-semibold text-gray-900">{t('initializationWizard.accounting.modes.invoiceDriven.title')}</div>
              <div className="text-sm text-gray-600">{t('initializationWizard.accounting.modes.invoiceDriven.description')}</div>
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
              <div className="font-semibold text-gray-900">{t('initializationWizard.accounting.modes.perpetual.title')}</div>
              <div className="text-sm text-gray-600">{t('initializationWizard.accounting.modes.perpetual.description')}</div>
            </div>
          </label>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">{t('initializationWizard.warehouse.title')}</h2>
          <p className="text-sm text-gray-600">{t('initializationWizard.warehouse.description')}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.warehouse.name')}</label>
            <input
              type="text"
              value={defaultWarehouseName}
              onChange={(e) => setDefaultWarehouseName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('initializationWizard.warehouse.defaultName')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.warehouse.code')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.warehouse.address')}</label>
            <textarea
              value={defaultWarehouseAddress}
              onChange={(e) => setDefaultWarehouseAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('initializationWizard.warehouse.addressPlaceholder')}
              rows={3}
            />
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('initializationWizard.settings.title')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.settings.costCurrency')}</label>
            <input
              type="text"
              value={defaultCostCurrency}
              onChange={(e) => setDefaultCostCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('initializationWizard.settings.costCurrencyPlaceholder')}
            />
          </div>

          {!accountingEnabled ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-700">{t('initializationWizard.settings.accountMapping')}</div>
                  <div className="text-xs text-gray-500 mt-1">{t('initializationWizard.settings.accountMappingLater')}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.settings.inventoryAssetAccount')}</label>
                <AccountSelector
                  value={defaultInventoryAssetAccountId}
                  onChange={(account: any) => setDefaultInventoryAssetAccountId(account?.id || '')}
                  placeholder={t('initializationWizard.settings.selectInventoryAsset')}
                  disabled={loadingAccounts}
                  accounts={inventoryAssetAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-600">
                  {accountingMode === 'PERPETUAL'
                    ? t('initializationWizard.settings.inventoryAssetHelp.perpetual')
                    : accountingMode === 'PERIODIC'
                      ? t('initializationWizard.settings.inventoryAssetHelp.periodic')
                      : t('initializationWizard.settings.inventoryAssetHelp.invoiceDriven')}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('initializationWizard.settings.selectorHelp')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.settings.cogsAccount')}</label>
                <AccountSelector
                  value={defaultCOGSAccountId}
                  onChange={(account: any) => setDefaultCOGSAccountId(account?.id || '')}
                  placeholder={t('initializationWizard.settings.selectCogs')}
                  disabled={loadingAccounts}
                  accounts={cogsAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-600">
                  {t('initializationWizard.settings.cogsHelp')}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('initializationWizard.settings.cogsSelectorHelp')}
                </p>
              </div>
            </div>
          )}

          <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-gray-900">{t('initializationWizard.settings.allowNegativeStock')}</div>
              <div className="text-xs text-gray-600">{t('initializationWizard.settings.allowNegativeStockHelp')}</div>
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
              <div className="text-sm font-semibold text-gray-900">{t('initializationWizard.settings.autoGenerateCodes')}</div>
              <div className="text-xs text-gray-600">{t('initializationWizard.settings.autoGenerateCodesHelp')}</div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.settings.prefix')}</label>
                <input
                  type="text"
                  value={itemCodePrefix}
                  onChange={(e) => setItemCodePrefix(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="ITM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('initializationWizard.settings.startingNumber')}</label>
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
        <h2 className="text-2xl font-bold text-gray-900">{t('initializationWizard.confirm.title')}</h2>
        <p className="text-sm text-gray-600">{t('initializationWizard.confirm.description')}</p>

        {!accountingEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t('initializationWizard.confirm.noAccountingWarning')}</span>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.accountingMethod')}:</span>{' '}
            <span className="text-gray-700">
              {t(`initializationWizard.accounting.modes.${accountingMode === 'INVOICE_DRIVEN' ? 'invoiceDriven' : accountingMode.toLowerCase()}.title`)}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.warehouse')}:</span>{' '}
            <span className="text-gray-700">{defaultWarehouseName} ({defaultWarehouseCode})</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.address')}:</span>{' '}
            <span className="text-gray-700">{defaultWarehouseAddress || t('initializationWizard.confirm.notProvided')}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.costCurrency')}:</span>{' '}
            <span className="text-gray-700">{defaultCostCurrency || t('initializationWizard.confirm.companyBaseCurrency')}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.inventoryAssetAccount')}:</span>{' '}
            <span className="text-gray-700">
              {selectedInventoryAssetAccount
                ? accountLabel(selectedInventoryAssetAccount)
                : accountingMode === 'PERPETUAL'
                  ? t('initializationWizard.confirm.notSelected')
                  : t('initializationWizard.confirm.notSelectedRecommended')}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.cogsAccount')}:</span>{' '}
            <span className="text-gray-700">
              {selectedCOGSAccount ? accountLabel(selectedCOGSAccount) : t('initializationWizard.confirm.notSelectedOptional')}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.allowNegativeStock')}:</span>{' '}
            <span className="text-gray-700">{allowNegativeStock ? t('initializationWizard.common.yes') : t('initializationWizard.common.no')}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.autoGenerateCodes')}:</span>{' '}
            <span className="text-gray-700">{autoGenerateItemCode ? t('initializationWizard.common.yes') : t('initializationWizard.common.no')}</span>
          </div>
          {autoGenerateItemCode && (
            <div className="text-sm">
              <span className="font-semibold text-gray-900">{t('initializationWizard.confirm.itemCodeRule')}:</span>{' '}
              <span className="text-gray-700">
                {t('initializationWizard.confirm.itemCodeRuleValue', {
                  prefix: itemCodePrefix || t('initializationWizard.confirm.noPrefix'),
                  next: itemCodeNextSeq,
                })}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {t('initializationWizard.confirm.onceNotice')}
        </div>
      </div>
    );
  })();

  return (
    <ModuleSetupWizardShell
      steps={stepTitleKeys.map((key) => t(`initializationWizard.steps.${key}`))}
      currentStep={currentStep}
      error={error}
      submitting={submitting}
      backLabel={t('initializationWizard.common.back')}
      nextLabel={t('initializationWizard.common.next')}
      completeLabel={t('initializationWizard.common.startInventory')}
      submittingLabel={t('initializationWizard.common.initializing')}
      onBack={goBack}
      onNext={goNext}
      onComplete={initialize}
    >
      {content}
    </ModuleSetupWizardShell>
  );
};
