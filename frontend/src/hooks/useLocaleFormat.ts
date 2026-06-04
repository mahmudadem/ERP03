import { useTranslation } from 'react-i18next';
import { formatMoney } from '../utils/formatMoney';

export const useLocaleFormat = () => {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(locale).format(value);

  // Delegates to the shared util so currency precision is consistent
  // and CLDR's 0-decimal default for SYP/JPY/KRW/etc. doesn't silently truncate.
  const formatCurrency = (value: number, currency: string, decimalPlaces?: number) =>
    formatMoney(value, currency, decimalPlaces);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);

  return { locale, formatNumber, formatCurrency, formatDate };
};
