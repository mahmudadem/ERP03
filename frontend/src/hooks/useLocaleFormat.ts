import { useTranslation } from 'react-i18next';

export const useLocaleFormat = () => {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(locale).format(value);

  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);

  return { locale, formatNumber, formatCurrency, formatDate };
};
