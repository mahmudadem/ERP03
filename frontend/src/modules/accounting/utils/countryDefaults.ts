import { findSupportedCountry } from '../../../config/supportedCountries';

export const getCountryDefaults = (countryValue: string) => {
  const country = findSupportedCountry(countryValue);

  return {
    currency: country?.currency ?? '',
    fiscalYearStart: country?.fiscalYearStart ?? '01-01',
    fiscalYearEnd: country?.fiscalYearEnd ?? '12-31',
    language: country?.language ?? 'en',
    timezone: country?.timezone ?? 'UTC',
    dateFormat: country?.dateFormat ?? 'MM/DD/YYYY',
  };
};
