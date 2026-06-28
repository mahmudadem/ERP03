import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom'; import { CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, ShoppingCart} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { Account, useAccounts } from '../../../context/AccountsContext';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { purchasesApi, PurchaseSettingsDTO } from '../../../api/purchasesApi';
import { inventoryApi } from '../../../api/inventoryApi';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { resolveInventoryAccountingMode } from '../../../utils/documentPolicy';
import { useCompanyModules } from '../../../hooks/useCompanyModules';

const stepTitles = ['Impact Assessment', 'Account Mappings', 'Review & Confirm'];

const accountLabel = (account: Account): string => `${account.code} - ${account.name}`;

export const PurchaseFinancialIntegrationWizard: React.FC = () => { 
  const { t } = useTranslation(['purchases', 'common']);
  const navigate = useNavigate();
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const { isModuleInitialized, loading: modulesLoading } = useCompanyModules();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modulesLoading) {
      if (!isModuleInitialized('purchase')) {
        navigate('/purchases', { replace: true });
        return;
      }
      if (!isModuleInitialized('accounting')) {
        navigate('/purchases/settings', { replace: true });
        return;
      }
    }
  }, [modulesLoading, isModuleInitialized, navigate]);

  const [defaultAPAccountId, setDefaultAPAccountId] = useState('');
  const [defaultPurchaseExpenseAccountId, setDefaultPurchaseExpenseAccountId] = useState('');
  const [defaultGRNIAccountId, setDefaultGRNIAccountId] = useState('');
  const [exchangeGainLossAccountId, setExchangeGainLossAccountId] = useState('');
  const [invSettings, setInvSettings] = useState<any>(null);
  const notSelectedLabel = t("auto.PurchaseFinancialIntegrationWizard.notSelected", "Not selected");

  const unwrap = <T,>(payload: any): T => {
    const data = payload?.data ?? payload;
    return (data?.data ?? data) as T;
  };

  React.useEffect(() => {
    inventoryApi.getSettings().then((res) => {
      setInvSettings(unwrap<any>(res));
    }).catch(() => {});
  }, []);

  const accountingMode = resolveInventoryAccountingMode(invSettings);
  const isPerpetual = accountingMode === 'PERPETUAL';

  const liabilityAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        String(a.classification || '').toUpperCase() === 'LIABILITY' &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const expenseAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        String(a.classification || '').toUpperCase() === 'EXPENSE' &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const allAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const stepError = useMemo(() => {
    if (currentStep === 1) {
      if (!defaultAPAccountId) return 'Default Accounts Payable account is required.';
      if (isPerpetual && !defaultGRNIAccountId) return 'Default GRNI account is required for perpetual accounting mode.';
    }
    return null;
  }, [currentStep, defaultAPAccountId, defaultGRNIAccountId, isPerpetual]);

  const goNext = () => {
    if (stepError) { setError(stepError); return; }
    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, stepTitles.length - 1));
  };

  const goBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const submit = async () => {
    if (stepError) { setError(stepError); return; }
    try {
      setSubmitting(true);
      setError(null);

      const settingsResult = await purchasesApi.getSettings();
      const current = unwrap<PurchaseSettingsDTO>(settingsResult);

      await purchasesApi.updateSettings({
        ...current,
        defaultAPAccountId,
        defaultPurchaseExpenseAccountId: defaultPurchaseExpenseAccountId || undefined,
        defaultGRNIAccountId: isPerpetual ? defaultGRNIAccountId || undefined : undefined,
        exchangeGainLossAccountId: exchangeGainLossAccountId || undefined,
      });

      emitCompanyModulesRefresh({ moduleCode: 'purchase' });
      navigate('/purchases/settings');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to configure financial integration.');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (() => {
    if (currentStep === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t("auto.PurchaseFinancialIntegrationWizard.purchaseFinancialIntegration", "Purchase Financial Integration")}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">{t("auto.PurchaseFinancialIntegrationWizard.configureHowPurchaseTransactionsPostToYourGeneral", "Configure how purchase transactions post to your General Ledger. This setup links your procurement workflows to the appropriate GL accounts.")}</p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left max-w-lg mx-auto">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-semibold">{t("auto.PurchaseFinancialIntegrationWizard.important", "Important")}</div>
                <div className="mt-1">{t("auto.PurchaseFinancialIntegrationWizard.accountMappingsCanBeChangedLaterFromPurchase", "Account mappings can be changed later from Purchase Settings, but all purchase transactions will use whatever mappings are active at posting time.")}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">{t("auto.PurchaseFinancialIntegrationWizard.accountMappings", "Account Mappings")}</h2>
          <p className="text-sm text-gray-600">{t("auto.PurchaseFinancialIntegrationWizard.selectTheGLAccountsThatPurchaseTransactionsWill", "Select the GL accounts that purchase transactions will post to.")}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auto.PurchaseFinancialIntegrationWizard.defaultAccountsPayable", "Default Accounts Payable")}<span className="text-red-500">*</span></label>
            <AccountSelector
              value={defaultAPAccountId}
              onChange={(account: any) => setDefaultAPAccountId(account?.id || '')}
              placeholder={t("auto.PurchaseFinancialIntegrationWizard.selectAPLiabilityAccount", "Select AP liability account")}
              disabled={loadingAccounts}
              accounts={liabilityAccounts as any}
            />
            <p className="mt-1 text-xs text-gray-500">{t("auto.PurchaseFinancialIntegrationWizard.primaryVendorLiabilityAccountUsedForAllPurchase", "Primary vendor liability account. Used for all purchase invoicing.")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auto.PurchaseFinancialIntegrationWizard.defaultPurchaseExpense", "Default Purchase Expense")}</label>
            <AccountSelector
              value={defaultPurchaseExpenseAccountId}
              onChange={(account: any) => setDefaultPurchaseExpenseAccountId(account?.id || '')}
              placeholder={t("auto.PurchaseFinancialIntegrationWizard.selectExpenseAccountOptional", "Select expense account (optional)")}
              disabled={loadingAccounts}
              accounts={expenseAccounts as any}
            />
            <p className="mt-1 text-xs text-gray-500">{t("auto.PurchaseFinancialIntegrationWizard.optionalFallbackForNonStockOrServicePurchases", "Optional fallback for non-stock or service purchases when an item account is not set.")}</p>
          </div>

          {isPerpetual ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auto.PurchaseFinancialIntegrationWizard.defaultGRNIAccount", "Default GRNI Account")}<span className="text-red-500">*</span></label>
              <AccountSelector
                value={defaultGRNIAccountId}
                onChange={(account: any) => setDefaultGRNIAccountId(account?.id || '')}
                placeholder={t("auto.PurchaseFinancialIntegrationWizard.selectGRNILiabilityAccount", "Select GRNI liability account")}
                disabled={loadingAccounts}
                accounts={liabilityAccounts as any}
              />
              <p className="mt-1 text-xs text-gray-500">{t("auto.PurchaseFinancialIntegrationWizard.requiredForPerpetualModeGoodsReceiptsCreditThis", "Required for perpetual mode. Goods Receipts credit this account before the Purchase Invoice clears it.")}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-700">{t("auto.PurchaseFinancialIntegrationWizard.invoiceDrivenPurchases", "Invoice-Driven Purchases")}</div>
                  <div className="text-xs text-gray-500 mt-1">{t("auto.PurchaseFinancialIntegrationWizard.gRNIIsNotRequiredInPeriodicModePurchase", "GRNI is not required in periodic mode. Purchase Invoices create the accounting effect directly.")}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auto.PurchaseFinancialIntegrationWizard.fXGainLossAccount", "FX Gain/Loss Account")}</label>
            <AccountSelector
              value={exchangeGainLossAccountId}
              onChange={(account: any) => setExchangeGainLossAccountId(account?.id || '')}
              placeholder={t("auto.PurchaseFinancialIntegrationWizard.selectFXGainLossAccountOptional", "Select FX gain/loss account (optional)")}
              disabled={loadingAccounts}
              accounts={allAccounts as any}
            />
            <p className="mt-1 text-xs text-gray-500">{t("auto.PurchaseFinancialIntegrationWizard.usedForPostingSupplierExchangeRateDifferences", "Used for posting supplier exchange rate differences.")}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">{t("auto.PurchaseFinancialIntegrationWizard.reviewAndConfirm", "Review & Confirm")}</h2>
        <p className="text-sm text-gray-600">{t("auto.PurchaseFinancialIntegrationWizard.reviewYourFinancialIntegrationSettings", "Review your financial integration settings.")}</p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t("auto.PurchaseFinancialIntegrationWizard.accountsPayable", "Accounts Payable:")}</span>{' '}
            <span className="text-gray-700">{defaultAPAccountId ? accountLabel(liabilityAccounts.find(a => a.id === defaultAPAccountId)!) : notSelectedLabel}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t("auto.PurchaseFinancialIntegrationWizard.purchaseExpense", "Purchase Expense:")}</span>{' '}
            <span className="text-gray-700">{defaultPurchaseExpenseAccountId ? accountLabel(expenseAccounts.find(a => a.id === defaultPurchaseExpenseAccountId)!) : notSelectedLabel}</span>
          </div>
          {isPerpetual && (
            <div className="text-sm">
              <span className="font-semibold text-gray-900">{t("auto.PurchaseFinancialIntegrationWizard.gRNI", "GRNI:")}</span>{' '}
              <span className="text-gray-700">{defaultGRNIAccountId ? accountLabel(liabilityAccounts.find(a => a.id === defaultGRNIAccountId)!) : notSelectedLabel}</span>
            </div>
          )}
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t("auto.PurchaseFinancialIntegrationWizard.fXGainLoss", "FX Gain/Loss:")}</span>{' '}
            <span className="text-gray-700">{exchangeGainLossAccountId ? accountLabel(allAccounts.find(a => a.id === exchangeGainLossAccountId)!) : notSelectedLabel}</span>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t("auto.PurchaseFinancialIntegrationWizard.theseMappingsTakeEffectImmediatelyForAllFuture", "These mappings take effect immediately for all future purchase transactions.")}</span>
          </div>
        </div>
      </div>
    );
  })();

  if (modulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isModuleInitialized('purchase') || !isModuleInitialized('accounting')) {
    return null;
  }

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
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isCompleted ? 'bg-white' : isCurrent ? 'bg-white ring-2 ring-white/50' : 'bg-white/30'}`} />
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
            <span className="text-xs font-medium text-white/90">{t("auto.PurchaseFinancialIntegrationWizard.step", "Step")}{currentStep + 1}{t("auto.PurchaseFinancialIntegrationWizard.of", "of")}{stepTitles.length}</span>
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
          <button type="button" onClick={goBack} disabled={currentStep === 0 || submitting} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />{t("auto.PurchaseFinancialIntegrationWizard.back", "Back")}</button>
          <div className="flex items-center gap-3">
            {currentStep < stepTitles.length - 1 ? (
              <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition">{t("auto.PurchaseFinancialIntegrationWizard.nextStep", "Next Step")}<ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 transition">
                {submitting ? (
                  <>
                    <Spinner size="sm" /> {t("auto.PurchaseFinancialIntegrationWizard.configuring", "Configuring...")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> {t("auto.PurchaseFinancialIntegrationWizard.enableIntegration", "Enable Integration")}
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
