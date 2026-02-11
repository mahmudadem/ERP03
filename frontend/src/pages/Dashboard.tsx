import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocaleFormat } from '../hooks/useLocaleFormat';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation(['dashboard']);
  const { formatCurrency, formatDate } = useLocaleFormat();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[var(--color-bg-primary)] p-6 rounded-lg shadow-sm border border-[var(--color-border)] transition-colors duration-300">
          <h3 className="text-[var(--color-text-secondary)] text-sm font-medium">
            {t('dashboard:metric', { number: i })}
          </h3>
          <p className="text-2xl font-bold mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(24500, 'USD')}
          </p>
          <div className="mt-4 text-success-500 text-sm font-medium">
            {t('dashboard:growth', { value: '12%' })}
          </div>
        </div>
      ))}
      
      <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-[var(--color-bg-primary)] p-6 rounded-lg shadow-sm h-96 border border-[var(--color-border)] transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('dashboard:activity')}</h2>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {t('dashboard:asOf', { date: formatDate(new Date()) })}
          </span>
        </div>
        <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
          {t('dashboard:chartPlaceholder')}
        </div>
      </div>

      <div className="bg-[var(--color-bg-primary)] p-6 rounded-lg shadow-sm h-96 border border-[var(--color-border)] transition-colors duration-300">
        <h2 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">{t('dashboard:quickActions')}</h2>
        <div className="space-y-3">
            <button className="w-full bg-primary-600 text-white py-2 rounded hover:bg-primary-700 transition shadow-sm">
              {t('dashboard:createInvoice')}
            </button>
            <button className="w-full border border-[var(--color-border)] text-[var(--color-text-primary)] py-2 rounded hover:bg-[var(--color-bg-tertiary)] transition">
              {t('dashboard:addInventory')}
            </button>
        </div>
      </div>
    </div>
  );
};
