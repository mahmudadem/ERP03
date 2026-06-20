/**
 * PosHomePage.tsx — Phase 0 placeholder. The full cashier screen
 * is implemented in Task 247c. This page now redirects to the
 * shift page (added in 247b) or surfaces a setup hint.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { posApi } from '../../../api/posApi';
import { Calculator, Clock, Settings } from 'lucide-react';

const PosHomePage: React.FC = () => {
  const { t } = useTranslation('pos');
  const navigate = useNavigate();
  const [initialized, setInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const s = await posApi.getSettings();
        setInitialized(!!s);
      } catch {
        setInitialized(false);
      }
    };
    void check();
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Calculator className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('title', { defaultValue: 'Point of Sale' })}
        </h1>
      </div>

      <Card>
        <div className="p-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>{t('home.subtitle', { defaultValue: 'Cashier terminal. Opens to the register the current user is signed in on.' })}</p>
          <p className="text-slate-500 italic">
            {t('home.comingSoon', { defaultValue: 'Cashier screen lands in Phase 247c. Configure registers and settings in the meantime.' })}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => navigate('/pos/shift')}
          className="text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 transition-colors"
        >
          <Clock className="w-5 h-5 text-indigo-600 mb-2" />
          <div className="font-medium">{t('home.shiftCta', { defaultValue: 'Open a shift' })}</div>
          <div className="text-xs text-slate-500 mt-1">{t('home.shiftCtaHelp', { defaultValue: 'Phase 247b' })}</div>
        </button>
        <button
          onClick={() => navigate('/pos/registers')}
          className="text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 transition-colors"
        >
          <Calculator className="w-5 h-5 text-indigo-600 mb-2" />
          <div className="font-medium">{t('home.registersCta', { defaultValue: 'Manage registers' })}</div>
          <div className="text-xs text-slate-500 mt-1">{t('home.registersCtaHelp', { defaultValue: 'Create a till before you can open a shift.' })}</div>
        </button>
        <button
          onClick={() => navigate('/pos/settings')}
          className="text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 transition-colors"
        >
          <Settings className="w-5 h-5 text-indigo-600 mb-2" />
          <div className="font-medium">{t('home.settingsCta', { defaultValue: 'Settings' })}</div>
          <div className="text-xs text-slate-500 mt-1">{t('home.settingsCtaHelp', { defaultValue: 'Walk-in customer, payment methods, over/short accounts.' })}</div>
        </button>
      </div>

      {initialized === false && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          {t('home.notInitialized', { defaultValue: 'POS settings have not been initialized yet. Open Settings to bootstrap defaults.' })}
        </div>
      )}
    </div>
  );
};

export default PosHomePage;
