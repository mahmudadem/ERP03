import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import arCommon from '../locales/ar/common.json';
import arDashboard from '../locales/ar/dashboard.json';
import trCommon from '../locales/tr/common.json';
import trDashboard from '../locales/tr/dashboard.json';

const resources = {
  en: { common: enCommon, dashboard: enDashboard },
  ar: { common: arCommon, dashboard: arDashboard },
  tr: { common: trCommon, dashboard: trDashboard },
};

const RTL_LANGS = ['ar'];

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
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'tr'],
    lng: 'en',
    ns: ['common', 'dashboard'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

applyDirection(i18n.language);
i18n.on('languageChanged', applyDirection);

export default i18n;
