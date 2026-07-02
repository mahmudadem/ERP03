import type { TFunction } from 'i18next';

export interface SupportedCountry {
  code: string;
  value: string;
  currency: string;
  timezone: string;
  language: 'ar' | 'en' | 'tr';
  dateFormat: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
}

export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = [
  { code: 'AE', value: 'United Arab Emirates', currency: 'AED', timezone: 'Asia/Dubai', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'SA', value: 'Saudi Arabia', currency: 'SAR', timezone: 'Asia/Riyadh', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'QA', value: 'Qatar', currency: 'QAR', timezone: 'Asia/Qatar', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'KW', value: 'Kuwait', currency: 'KWD', timezone: 'Asia/Kuwait', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'BH', value: 'Bahrain', currency: 'BHD', timezone: 'Asia/Bahrain', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'OM', value: 'Oman', currency: 'OMR', timezone: 'Asia/Muscat', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'JO', value: 'Jordan', currency: 'JOD', timezone: 'Asia/Amman', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'LB', value: 'Lebanon', currency: 'LBP', timezone: 'Asia/Beirut', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'PS', value: 'Palestine', currency: 'ILS', timezone: 'Asia/Hebron', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'SY', value: 'Syria', currency: 'SYP', timezone: 'Asia/Damascus', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'IQ', value: 'Iraq', currency: 'IQD', timezone: 'Asia/Baghdad', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'EG', value: 'Egypt', currency: 'EGP', timezone: 'Africa/Cairo', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'DZ', value: 'Algeria', currency: 'DZD', timezone: 'Africa/Algiers', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'MA', value: 'Morocco', currency: 'MAD', timezone: 'Africa/Casablanca', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'TN', value: 'Tunisia', currency: 'TND', timezone: 'Africa/Tunis', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'LY', value: 'Libya', currency: 'LYD', timezone: 'Africa/Tripoli', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'SD', value: 'Sudan', currency: 'SDG', timezone: 'Africa/Khartoum', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'YE', value: 'Yemen', currency: 'YER', timezone: 'Asia/Aden', language: 'ar', dateFormat: 'DD/MM/YYYY' },
  { code: 'TR', value: 'Turkey', currency: 'TRY', timezone: 'Europe/Istanbul', language: 'tr', dateFormat: 'DD/MM/YYYY' },
  { code: 'US', value: 'United States', currency: 'USD', timezone: 'America/New_York', language: 'en', dateFormat: 'MM/DD/YYYY' },
  { code: 'GB', value: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London', language: 'en', dateFormat: 'DD/MM/YYYY', fiscalYearStart: '04-01', fiscalYearEnd: '03-31' },
  { code: 'DE', value: 'Germany', currency: 'EUR', timezone: 'Europe/Berlin', language: 'en', dateFormat: 'DD.MM.YYYY' },
  { code: 'FR', value: 'France', currency: 'EUR', timezone: 'Europe/Paris', language: 'en', dateFormat: 'DD/MM/YYYY' },
  { code: 'IT', value: 'Italy', currency: 'EUR', timezone: 'Europe/Rome', language: 'en', dateFormat: 'DD/MM/YYYY' },
  { code: 'ES', value: 'Spain', currency: 'EUR', timezone: 'Europe/Madrid', language: 'en', dateFormat: 'DD/MM/YYYY' },
  { code: 'NL', value: 'Netherlands', currency: 'EUR', timezone: 'Europe/Amsterdam', language: 'en', dateFormat: 'DD-MM-YYYY' },
  { code: 'BE', value: 'Belgium', currency: 'EUR', timezone: 'Europe/Brussels', language: 'en', dateFormat: 'DD/MM/YYYY' },
  { code: 'CH', value: 'Switzerland', currency: 'CHF', timezone: 'Europe/Zurich', language: 'en', dateFormat: 'DD.MM.YYYY' },
  { code: 'AT', value: 'Austria', currency: 'EUR', timezone: 'Europe/Vienna', language: 'en', dateFormat: 'DD.MM.YYYY' },
  { code: 'SE', value: 'Sweden', currency: 'SEK', timezone: 'Europe/Stockholm', language: 'en', dateFormat: 'YYYY-MM-DD' },
  { code: 'NO', value: 'Norway', currency: 'NOK', timezone: 'Europe/Oslo', language: 'en', dateFormat: 'DD.MM.YYYY' },
  { code: 'DK', value: 'Denmark', currency: 'DKK', timezone: 'Europe/Copenhagen', language: 'en', dateFormat: 'DD-MM-YYYY' },
  { code: 'IE', value: 'Ireland', currency: 'EUR', timezone: 'Europe/Dublin', language: 'en', dateFormat: 'DD/MM/YYYY' },
  { code: 'PL', value: 'Poland', currency: 'PLN', timezone: 'Europe/Warsaw', language: 'en', dateFormat: 'DD.MM.YYYY' },
  { code: 'GR', value: 'Greece', currency: 'EUR', timezone: 'Europe/Athens', language: 'en', dateFormat: 'DD/MM/YYYY' },
  { code: 'CY', value: 'Cyprus', currency: 'EUR', timezone: 'Asia/Nicosia', language: 'en', dateFormat: 'DD/MM/YYYY' },
];

const supportedCountriesByValue = new Map(
  SUPPORTED_COUNTRIES.map((country) => [country.value, country])
);

export const findSupportedCountry = (value?: string): SupportedCountry | undefined =>
  value ? supportedCountriesByValue.get(value) : undefined;

export const getCountryLabel = (
  country: SupportedCountry,
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  t(`systemMetadata.countries.${country.code}`, {
    lng: language,
    defaultValue: country.value,
  });

export const getCountrySearchText = (country: SupportedCountry, t: TFunction): string =>
  (['ar', 'en', 'tr'] as const)
    .map((language) => getCountryLabel(country, t, language))
    .concat(country.value, country.code)
    .join(' ')
    .toLocaleLowerCase();
