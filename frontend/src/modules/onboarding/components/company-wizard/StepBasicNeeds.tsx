import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Coins, ReceiptText, ShieldCheck, Wand2 } from 'lucide-react';
import { WizardStepProps } from './types';
import { getCountryDefaults } from '../../../accounting/utils/countryDefaults';

const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'SYP',
  'TRY',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'JOD',
  'EGP',
  'GBP',
  'CAD',
  'AUD',
  'INR',
];

const TIMEZONE_OPTIONS = [
  'UTC',
  'Asia/Damascus',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'Asia/Kolkata',
];

const DATE_FORMAT_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY', 'YYYY/MM/DD'];
const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
];

export const StepBasicNeeds: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack }) => {
  const { t } = useTranslation('common');
  const [error, setError] = React.useState('');
  const isStarterEnabled = data.autoInitializeModules !== false;

  const countryDefaults = React.useMemo(() => {
    return data.country ? getCountryDefaults(data.country) : getCountryDefaults('');
  }, [data.country]);
  const suggestedCurrency = countryDefaults.currency;

  React.useEffect(() => {
    const defaults: Partial<typeof data> = {};
    if (!data.currency && countryDefaults.currency) defaults.currency = countryDefaults.currency;
    if (!data.timezone && countryDefaults.timezone) defaults.timezone = countryDefaults.timezone;
    if (!data.dateFormat && countryDefaults.dateFormat) defaults.dateFormat = countryDefaults.dateFormat;
    if (!data.language && countryDefaults.language) defaults.language = countryDefaults.language;

    if (Object.keys(defaults).length > 0) {
      updateData(defaults);
    }
  }, [countryDefaults, data.currency, data.dateFormat, data.language, data.timezone, updateData]);

  const currencyOptions = React.useMemo(() => {
    return Array.from(new Set([suggestedCurrency, data.currency, ...COMMON_CURRENCIES].filter(Boolean)));
  }, [data.currency, suggestedCurrency]);

  const handleNext = () => {
    if (!data.currency?.trim()) {
      setError(t('onboarding.companyWizard.needs.errors.currencyRequired', { defaultValue: 'Base currency is required before initializing modules.' }));
      return;
    }

    updateData({
      currency: data.currency.trim().toUpperCase(),
      timezone: data.timezone || countryDefaults.timezone || 'UTC',
      dateFormat: data.dateFormat || countryDefaults.dateFormat || 'MM/DD/YYYY',
      language: data.language || countryDefaults.language || 'en',
      autoInitializeModules: data.autoInitializeModules !== false,
      starterTemplateId: data.autoInitializeModules === false ? undefined : 'simple-trading-company',
    });
    onNext();
  };

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 md:pr-2">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4 md:gap-6">
          <div className="space-y-4">
            <section className="border border-slate-200 rounded-lg p-4 md:p-5 bg-white">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm md:text-base font-semibold text-slate-900">
                    {t('onboarding.companyWizard.needs.company.title', { defaultValue: 'Company Defaults' })}
                  </h3>
                  <p className="text-xs md:text-sm text-slate-600 mt-1">
                    {t('onboarding.companyWizard.needs.company.description', {
                      defaultValue: 'Set the financial and regional defaults every company needs before review.',
                    })}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label htmlFor="baseCurrency" className="block text-xs font-semibold text-slate-600 mb-1">
                    {t('onboarding.companyWizard.needs.currency.field', { defaultValue: 'Currency Code' })}
                  </label>
                  <select
                    id="baseCurrency"
                    value={data.currency || ''}
                    onChange={(event) => {
                      updateData({ currency: event.target.value });
                      setError('');
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
                  >
                    <option value="">{t('onboarding.companyWizard.needs.currency.placeholder', { defaultValue: 'Select currency' })}</option>
                    {currencyOptions.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                  {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-xs font-semibold text-slate-600 mb-1">
                    {t('onboarding.companyWizard.needs.timezone.field', { defaultValue: 'Timezone' })}
                  </label>
                  <select
                    id="timezone"
                    value={data.timezone || countryDefaults.timezone || 'UTC'}
                    onChange={(event) => updateData({ timezone: event.target.value })}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
                  >
                    {TIMEZONE_OPTIONS.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dateFormat" className="block text-xs font-semibold text-slate-600 mb-1">
                    {t('onboarding.companyWizard.needs.dateFormat.field', { defaultValue: 'Date Format' })}
                  </label>
                  <select
                    id="dateFormat"
                    value={data.dateFormat || countryDefaults.dateFormat || 'MM/DD/YYYY'}
                    onChange={(event) => updateData({ dateFormat: event.target.value })}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
                  >
                    {DATE_FORMAT_OPTIONS.map((format) => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="language" className="block text-xs font-semibold text-slate-600 mb-1">
                    {t('onboarding.companyWizard.needs.language.field', { defaultValue: 'Language' })}
                  </label>
                  <select
                    id="language"
                    value={data.language || countryDefaults.language || 'en'}
                    onChange={(event) => updateData({ language: event.target.value })}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
                  >
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.code} value={language.code}>{language.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">
                  {t('onboarding.companyWizard.needs.currency.noteTitle', { defaultValue: 'Accounting note' })}
                </span>
                <span className="block mt-1">
                  {t('onboarding.companyWizard.needs.currency.note', {
                    defaultValue: 'Changing base currency after posting transactions is normally restricted in ERP systems.',
                  })}
                </span>
              </div>
            </section>

            <section className="border border-slate-200 rounded-lg p-4 md:p-5 bg-white">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.autoInitializeModules !== false}
                  onChange={(event) => {
                    updateData({
                      autoInitializeModules: event.target.checked,
                      starterTemplateId: event.target.checked ? 'simple-trading-company' : undefined,
                    });
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-sm md:text-base font-semibold text-slate-900">
                    <Wand2 className="h-4 w-4 text-primary-600" />
                    {t('onboarding.companyWizard.needs.starter.title', { defaultValue: 'Auto initialize Trading Company - Simple' })}
                  </span>
                  <span className="mt-2 block text-xs md:text-sm text-slate-600 leading-relaxed">
                    {t('onboarding.companyWizard.needs.starter.description', {
                      defaultValue:
                        'Best for a small company that wants to start buying, selling, and moving stock immediately with standard controls.',
                    })}
                  </span>
                </span>
              </label>
            </section>
          </div>

          <aside className="border border-slate-200 rounded-lg p-4 md:p-5 bg-slate-50 h-fit">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary-600" />
              {t('onboarding.companyWizard.needs.summary.title', { defaultValue: 'Company Setup Summary' })}
            </h4>
            <div className="mt-4 space-y-3">
              {[
                t('onboarding.companyWizard.needs.summary.companyDefaults', { currency: data.currency || '-', timezone: data.timezone || countryDefaults.timezone || 'UTC', defaultValue: 'Currency {{currency}}, timezone {{timezone}}' }),
                t('onboarding.companyWizard.needs.summary.fiscal', { defaultValue: 'Calendar fiscal year and company date defaults' }),
                ...(isStarterEnabled
                  ? [
                    t('onboarding.companyWizard.needs.summary.accounting', { defaultValue: 'Standard chart of accounts' }),
                    t('onboarding.companyWizard.needs.summary.inventory', { defaultValue: 'Invoice-driven stock with global average cost and negative stock blocked' }),
                    t('onboarding.companyWizard.needs.summary.warehouse', { defaultValue: 'Default MAIN warehouse' }),
                    t('onboarding.companyWizard.needs.summary.sales', { defaultValue: 'Simple direct sales invoicing' }),
                    t('onboarding.companyWizard.needs.summary.purchases', { defaultValue: 'Simple direct purchase invoicing' }),
                    t('onboarding.companyWizard.needs.summary.tax', { defaultValue: 'Tax-ready setup without hidden legal rates' }),
                  ]
                  : [
                    t('onboarding.companyWizard.needs.summary.manual', { defaultValue: 'Modules will be installed, but each setup wizard remains manual' }),
                  ]),
              ].map((label) => (
                <div key={label} className="flex items-start gap-2 text-xs md:text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md bg-white border border-slate-200 p-3 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                {t('onboarding.companyWizard.needs.summary.policy', {
                  defaultValue: 'The final policy summary will show the linked accounts and operational settings after creation.',
                })}
              </span>
            </div>
          </aside>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 bg-white flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-slate-100 h-10 px-4 py-2"
        >
          {t('onboarding.companyWizard.needs.actions.back', { defaultValue: 'Back' })}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary-600 text-white hover:bg-primary-600/90 h-10 px-6 py-2"
        >
          {t('onboarding.companyWizard.needs.actions.nextStep', { defaultValue: 'Continue' })}
        </button>
      </div>
    </div>
  );
};
