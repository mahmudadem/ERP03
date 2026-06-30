import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import enAccounting from '../locales/en/accounting.json';
import enAiAssistant from '../locales/en/aiAssistant.json';
import enPos from '../locales/en/pos.json';
import enControls from '../locales/en/controls.json';
import enPurchases from '../locales/en/purchases.json';
import arCommon from '../locales/ar/common.json';
import arDashboard from '../locales/ar/dashboard.json';
import arAccounting from '../locales/ar/accounting.json';
import arAiAssistant from '../locales/ar/aiAssistant.json';
import arPos from '../locales/ar/pos.json';
import arControls from '../locales/ar/controls.json';
import arPurchases from '../locales/ar/purchases.json';
import trCommon from '../locales/tr/common.json';
import trDashboard from '../locales/tr/dashboard.json';
import trAccounting from '../locales/tr/accounting.json';
import trAiAssistant from '../locales/tr/aiAssistant.json';
import trPos from '../locales/tr/pos.json';
import trControls from '../locales/tr/controls.json';
import trPurchases from '../locales/tr/purchases.json';

const resources = {
  en: { common: enCommon, dashboard: enDashboard, accounting: enAccounting, aiAssistant: enAiAssistant, pos: enPos, controls: enControls, purchases: enPurchases },
  ar: { common: arCommon, dashboard: arDashboard, accounting: arAccounting, aiAssistant: arAiAssistant, pos: arPos, controls: arControls, purchases: arPurchases },
  tr: { common: trCommon, dashboard: trDashboard, accounting: trAccounting, aiAssistant: trAiAssistant, pos: trPos, controls: trControls, purchases: trPurchases },
};

const RTL_LANGS = ['ar'];
const DEFAULT_LANGUAGE = 'en';

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  const savedLanguage = window.localStorage.getItem('erp_language');
  const initialLanguage = savedLanguage || DEFAULT_LANGUAGE;

  // App.tsx still runs the legacy IP detector. Seed its compatibility key so
  // geography cannot override the product default or an explicit user choice.
  window.localStorage.setItem('i18nextLng', initialLanguage);
  return initialLanguage;
};

const applyDirection = (lng: string) => {
  const isRtl = RTL_LANGS.includes(lng);
  if (typeof document !== 'undefined') {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ['en', 'ar', 'tr'],
    ns: ['common', 'dashboard', 'accounting', 'aiAssistant', 'pos', 'controls', 'purchases'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

applyDirection(i18n.language);
i18n.on('languageChanged', applyDirection);

export default i18n;
