
import React from 'react';
import { WizardStepProps } from './types';
import { Check, ArrowRight, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const StepSuccess: React.FC<WizardStepProps & { onComplete: () => void }> = ({ data, onComplete }) => {
  const { t } = useTranslation('common');
  const summary = data.starterPolicySummary;
  const accountRows = summary
    ? [
        ['cash', t('onboarding.companyWizard.success.policy.accounts.cash', { defaultValue: 'Cash' })],
        ['bank', t('onboarding.companyWizard.success.policy.accounts.bank', { defaultValue: 'Bank' })],
        ['inventoryAsset', t('onboarding.companyWizard.success.policy.accounts.inventoryAsset', { defaultValue: 'Inventory Asset' })],
        ['arParent', t('onboarding.companyWizard.success.policy.accounts.arParent', { defaultValue: 'Customers Receivable' })],
        ['apParent', t('onboarding.companyWizard.success.policy.accounts.apParent', { defaultValue: 'Accounts Payable' })],
        ['salesRevenue', t('onboarding.companyWizard.success.policy.accounts.salesRevenue', { defaultValue: 'Sales Revenue' })],
        ['cogs', t('onboarding.companyWizard.success.policy.accounts.cogs', { defaultValue: 'Cost of Goods Sold' })],
      ]
    : [];

  return (
    <div className="flex flex-col items-center justify-center h-full py-6 md:py-12 text-center animate-in zoom-in-95 duration-500">
      <div className="h-16 w-16 md:h-24 md:w-24 rounded-full bg-green-100 flex items-center justify-center mb-4 md:mb-6">
        <Check className="h-8 w-8 md:h-12 md:w-12 text-green-600" />
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{t('onboarding.companyWizard.success.title')}</h2>
      <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto mb-6 md:mb-8 px-4">
        {t('onboarding.companyWizard.success.subtitle')}
      </p>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 md:mb-8 max-w-sm w-full text-left mx-4">
        <h4 className="font-semibold text-xs md:text-sm text-slate-800 mb-2">{t('onboarding.companyWizard.success.whatsNext')}</h4>
        <ul className="space-y-2 text-xs md:text-sm text-slate-600">
          <li className="flex gap-2">
            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">1</div>
            <span>{t('onboarding.companyWizard.success.steps.setupAccounting')}</span>
          </li>
          <li className="flex gap-2">
            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">2</div>
            <span>{t('onboarding.companyWizard.success.steps.inviteUsers')}</span>
          </li>
        </ul>
      </div>

      {summary && (
        <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 md:mb-8 max-w-2xl w-full text-left mx-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-primary-600" />
            <h4 className="font-semibold text-xs md:text-sm text-slate-800">
              {t('onboarding.companyWizard.success.policy.title', { defaultValue: 'Company Policy Summary' })}
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mb-4">
            <div>
              <span className="font-medium text-slate-500">{t('onboarding.companyWizard.success.policy.template', { defaultValue: 'Template' })}: </span>
              <span className="font-semibold text-slate-900">{summary.templateName}</span>
            </div>
            <div>
              <span className="font-medium text-slate-500">{t('onboarding.companyWizard.success.policy.currency', { defaultValue: 'Base Currency' })}: </span>
              <span className="font-semibold text-slate-900">{summary.baseCurrency}</span>
            </div>
            <div>
              <span className="font-medium text-slate-500">{t('onboarding.companyWizard.success.policy.inventory', { defaultValue: 'Inventory' })}: </span>
              <span className="font-semibold text-slate-900">
                {summary.inventory.accountingMode} / {summary.inventory.costingBasis}
              </span>
            </div>
            <div>
              <span className="font-medium text-slate-500">{t('onboarding.companyWizard.success.policy.sales', { defaultValue: 'Sales/Purchases' })}: </span>
              <span className="font-semibold text-slate-900">{summary.sales.workflowMode}</span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">
              {t('onboarding.companyWizard.success.policy.linkedAccounts', { defaultValue: 'Linked Accounts' })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {accountRows.map(([key, label]) => {
                const account = summary.linkedAccounts[key];
                if (!account) return null;
                return (
                  <div key={key} className="flex justify-between gap-3">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-900 truncate">{account.code} · {account.name}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">{summary.tax.note}</p>
          </div>
        </div>
      )}

      <button
        onClick={onComplete}
        className="inline-flex items-center justify-center rounded-md text-sm md:text-base font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary-600 text-white hover:bg-primary-600/90 h-10 md:h-11 px-6 md:px-8 py-2 shadow-lg hover:shadow-xl transform transition-all active:scale-95"
      >
        {t('onboarding.companyWizard.success.goToDashboard')}
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </div>
  );
};
