import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom'; import { CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, TrendingUp} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { Account, useAccounts } from '../../../context/AccountsContext';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { SalesSettingsDTO, salesApi } from '../../../api/salesApi';
import { inventoryApi } from '../../../api/inventoryApi';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { resolveInventoryAccountingMode } from '../../../utils/documentPolicy';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { useTranslation } from "react-i18next";

const stepTitles = ['Impact Assessment', 'Account Mappings', 'Review & Confirm'];

const accountLabel = (account: Account): string => `${account.code} - ${account.name}`;

export const SalesFinancialIntegrationWizard: React.FC = () => {
    const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const { isModuleInitialized, loading: modulesLoading } = useCompanyModules();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modulesLoading) {
      if (!isModuleInitialized('sales')) {
        navigate('/sales', { replace: true });
        return;
      }
      if (!isModuleInitialized('accounting')) {
        navigate('/sales/settings', { replace: true });
        return;
      }
    }
  }, [modulesLoading, isModuleInitialized, navigate]);

  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState('');
  const [defaultARAccountId, setDefaultARAccountId] = useState('');
  const [defaultSalesExpenseAccountId, setDefaultSalesExpenseAccountId] = useState('');
  const [invSettings, setInvSettings] = useState<any>(null);

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

  const revenueAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        ['REVENUE', 'INCOME'].includes(String(a.classification || '').toUpperCase()) &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const assetAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        String(a.classification || '').toUpperCase() === 'ASSET' &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const expenseAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        ['EXPENSE', 'COGS'].includes(String(a.classification || '').toUpperCase()) &&
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
      if (!defaultRevenueAccountId) return 'Default Revenue account is required.';
    }
    return null;
  }, [currentStep, defaultRevenueAccountId]);

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

      const settingsResult = await salesApi.getSettings();
      const current = unwrap<SalesSettingsDTO>(settingsResult);

      await salesApi.updateSettings({
        ...current,
        defaultRevenueAccountId,
        defaultARAccountId: defaultARAccountId || undefined,
        defaultSalesExpenseAccountId: defaultSalesExpenseAccountId || undefined,
      });

      emitCompanyModulesRefresh({ moduleCode: 'sales' });
      navigate('/sales/settings');
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
            <TrendingUp className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t(`Sales Financial Integration`)}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Configure how sales transactions post to your General Ledger. This setup links your revenue and receivables workflows to the appropriate GL accounts.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left max-w-lg mx-auto">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-semibold">{t(`Important`)}</div>
                <div className="mt-1">{t(`Account mappings can be changed later from Sales Settings, but all sales transactions will use whatever mappings are active at posting time.`)}</div>
              </div>
            </div>
          </div>
          {isPerpetual && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left max-w-lg mx-auto mt-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <div className="font-semibold">{t(`Perpetual Inventory Active`)}</div>
                  <div className="mt-1">{t(`Your inventory is running in perpetual mode. Delivery Notes will create inventory accounting entries. Sales invoices post to the revenue account you configure here.`)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">{t(`Account Mappings`)}</h2>
          <p className="text-sm text-gray-600">{t(`Select the GL accounts that sales transactions will post to.`)}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default Revenue Account`)} <span className="text-red-500">*</span></label>
            <AccountSelector
              value={defaultRevenueAccountId}
              onChange={(account: any) => setDefaultRevenueAccountId(account?.id || '')}
              placeholder="Select revenue posting account"
              disabled={loadingAccounts}
              accounts={revenueAccounts as any}
            />
            <p className="mt-1 text-xs text-gray-500">{t(`Primary revenue account used for all sales invoicing.`)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default Accounts Receivable`)}</label>
            <AccountSelector
              value={defaultARAccountId}
              onChange={(account: any) => setDefaultARAccountId(account?.id || '')}
              placeholder="Select AR asset account (optional)"
              disabled={loadingAccounts}
              accounts={assetAccounts as any}
            />
            <p className="mt-1 text-xs text-gray-500">{t(`Customer receivables account. If not set, you will need to specify it per invoice or customer.`)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default Sales Expense Account`)}</label>
            <AccountSelector
              value={defaultSalesExpenseAccountId}
              onChange={(account: any) => setDefaultSalesExpenseAccountId(account?.id || '')}
              placeholder="Select expense account (optional)"
              disabled={loadingAccounts}
              accounts={expenseAccounts as any}
            />
            <p className="mt-1 text-xs text-gray-500">{t(`Optional fallback for sales-related expense postings.`)}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">{t(`Review & Confirm`)}</h2>
        <p className="text-sm text-gray-600">{t(`Review your financial integration settings.`)}</p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Revenue Account:`)}</span>{' '}
            <span className="text-gray-700">{defaultRevenueAccountId ? accountLabel(allAccounts.find(a => a.id === defaultRevenueAccountId)!) : 'Not selected'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Accounts Receivable:`)}</span>{' '}
            <span className="text-gray-700">{defaultARAccountId ? accountLabel(allAccounts.find(a => a.id === defaultARAccountId)!) : 'Not selected'}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Sales Expense:`)}</span>{' '}
            <span className="text-gray-700">{defaultSalesExpenseAccountId ? accountLabel(allAccounts.find(a => a.id === defaultSalesExpenseAccountId)!) : 'Not selected'}</span>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t(`These mappings take effect immediately for all future sales transactions.`)}</span>
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

  if (!isModuleInitialized('sales') || !isModuleInitialized('accounting')) {
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
            <span className="text-xs font-medium text-white/90">{t(`Step`)} {currentStep + 1} {t(`of`)} {stepTitles.length}</span>
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
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            {currentStep < stepTitles.length - 1 ? (
              <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition">
                {t(`Next Step`)} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 transition">
                {submitting ? (<><Spinner size="sm" /> {t(`Configuring...`)}</>) : (<><CheckCircle2 className="w-4 h-4" /> {t(`Enable Integration`)}</>)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};