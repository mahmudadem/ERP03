import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyProfile } from '../../../hooks/useCompanyAdmin';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { Camera, Upload, Trash2, Loader2, Building2 } from 'lucide-react';
import { processImage } from '../../../lib/image-utils';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';

const MONTHS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 7 },
  { value: 8 },
  { value: 9 },
  { value: 10 },
  { value: 11 },
  { value: 12 },
];

const CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'TRY', 'SAR', 'AED', 'EGP', 'QAR', 'KWD',
  'BHD', 'OMR', 'JOD', 'LBP', 'IQD', 'SYP', 'YER', 'JPY',
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', offset: 'GMT+0' },
  { value: 'Europe/Istanbul', offset: 'GMT+3' },
  { value: 'Europe/London', offset: 'GMT+0/1' },
  { value: 'America/New_York', offset: 'GMT-5/4' },
  { value: 'Asia/Dubai', offset: 'GMT+4' },
  { value: 'Asia/Riyadh', offset: 'GMT+3' },
  { value: 'Africa/Cairo', offset: 'GMT+2' },
  { value: 'Asia/Qatar', offset: 'GMT+3' },
  { value: 'Asia/Kuwait', offset: 'GMT+3' },
  { value: 'Asia/Bahrain', offset: 'GMT+3' },
  { value: 'Asia/Muscat', offset: 'GMT+4' },
  { value: 'Asia/Amman', offset: 'GMT+3' },
  { value: 'Asia/Beirut', offset: 'GMT+2' },
  { value: 'Asia/Baghdad', offset: 'GMT+3' },
  { value: 'Asia/Aden', offset: 'GMT+3' },
  { value: 'Asia/Damascus', offset: 'GMT+3' },
  { value: 'Asia/Hebron', offset: 'GMT+2' },
  { value: 'Asia/Tokyo', offset: 'GMT+9' },
  { value: 'Asia/Shanghai', offset: 'GMT+8' },
  { value: 'Asia/Singapore', offset: 'GMT+8' },
  { value: 'Asia/Seoul', offset: 'GMT+9' },
  { value: 'Australia/Sydney', offset: 'GMT+11' },
  { value: 'Europe/Berlin', offset: 'GMT+1' },
  { value: 'Europe/Paris', offset: 'GMT+1' },
  { value: 'Europe/Madrid', offset: 'GMT+1' },
  { value: 'Europe/Rome', offset: 'GMT+1' },
  { value: 'Europe/Moscow', offset: 'GMT+3' },
  { value: 'America/Toronto', offset: 'GMT-5' },
  { value: 'America/Sao_Paulo', offset: 'GMT-3' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', example: '2025-12-31' },
  { value: 'DD/MM/YYYY', example: '31/12/2025' },
  { value: 'MM/DD/YYYY', example: '12/31/2025' },
];

export const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const { profile, isLoading, updateProfile, isUpdating } = useCompanyProfile();
  const { settings, updateSettings } = useCompanySettings();
  const { theme, toggleTheme } = useUserPreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const currencyDisplayNames = useMemo(() => new Intl.DisplayNames([i18n.language || 'en'], { type: 'currency' }), [i18n.language]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language || 'en', { month: 'long' }), [i18n.language]);
  
  const [formData, setFormData] = useState({
    name: '',
    baseCurrency: '',
    fiscalYearStart: 1,
    fiscalYearEnd: 12,
    taxId: '',
    address: '',
    logoUrl: '',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    language: 'en'
  });

  useEffect(() => {
    if (profile || settings) {
      setFormData(prev => ({
        ...prev,
        ...(profile ? {
          name: profile.name || '',
          baseCurrency: (profile as any).baseCurrency || (profile as any).currency || '',
          fiscalYearStart: Number((profile as any).fiscalYearStart) || 1,
          fiscalYearEnd: Number((profile as any).fiscalYearEnd) || 12,
          taxId: profile.taxId || '',
          address: profile.address || '',
          logoUrl: profile.logoUrl || '',
        } : {}),
        ...(settings ? {
          timezone: settings.timezone || 'UTC',
          dateFormat: settings.dateFormat || 'YYYY-MM-DD',
          language: (settings as any).language || 'en',
        } : {})
      }));
    }
  }, [profile, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update Profile
    updateProfile({
      name: formData.name,
      baseCurrency: formData.baseCurrency,
      fiscalYearStart: Number(formData.fiscalYearStart),
      fiscalYearEnd: Number(formData.fiscalYearEnd),
      logoUrl: formData.logoUrl,
    } as any);

    // Update Company Settings
    await updateSettings({
      timezone: formData.timezone,
      dateFormat: formData.dateFormat,
      language: formData.language
    } as any);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setIsProcessingLogo(true);
        const processedDataUrl = await processImage(file, 512, 0.85);
        setFormData(prev => ({ ...prev, logoUrl: processedDataUrl }));
      } catch (err) {
        console.error("Failed to process logo", err);
      } finally {
        setIsProcessingLogo(false);
      }
    }
  };

  const removeLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
  };

  const handleReset = () => {
    if (profile || settings) {
      setFormData({
        name: profile?.name || '',
        baseCurrency: (profile as any)?.baseCurrency || (profile as any)?.currency || '',
        fiscalYearStart: Number((profile as any)?.fiscalYearStart) || 1,
        fiscalYearEnd: Number((profile as any)?.fiscalYearEnd) || 12,
        taxId: profile?.taxId || '',
        address: profile?.address || '',
        logoUrl: profile?.logoUrl || '',
        timezone: settings?.timezone || 'UTC',
        dateFormat: settings?.dateFormat || 'YYYY-MM-DD',
        language: (settings as any)?.language || 'en',
      });
    }
  };

  if (isLoading) {
    return (
      <CompanyAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CompanyAdminLayout>
    );
  }

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t('companyAdmin.settings.title', { defaultValue: 'Settings' })} 
        breadcrumbs={[
          { label: t('companyAdmin.shared.companyAdmin', { defaultValue: 'Company Admin' }) },
          { label: t('companyAdmin.settings.title', { defaultValue: 'Settings' }) },
        ]}
      />

      <div className="max-w-4xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Logo Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
                {t('companyAdmin.settings.companyLogo', { defaultValue: 'Company Logo' })}
              </h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="relative h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 group">
                  {formData.logoUrl ? (
                    <>
                      <img src={formData.logoUrl} alt="Company logo" className="max-h-full max-w-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 bg-white rounded-full text-gray-700 hover:text-blue-600 shadow-sm"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="p-1.5 bg-white rounded-full text-gray-700 hover:text-red-500 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">
                        {t('companyAdmin.settings.noLogo', { defaultValue: 'No Logo' })}
                      </p>
                    </div>
                  )}
                  {isProcessingLogo && (
                    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <p className="text-[10px] text-blue-600 mt-1 font-bold animate-pulse">
                        {t('companyAdmin.settings.wait', { defaultValue: 'Wait...' })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-600">
                    {t('companyAdmin.settings.logoHint', {
                      defaultValue: 'This logo will appear on your dashboard, vouchers, and reports. For best results, use a square image with a transparent background.',
                    })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingLogo}
                    >
                      {formData.logoUrl
                        ? t('companyAdmin.settings.changeLogo', { defaultValue: 'Change Logo' })
                        : t('companyAdmin.settings.uploadLogo', { defaultValue: 'Upload Logo' })}
                    </Button>
                    {formData.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={removeLogo}
                      >
                        {t('companyAdmin.shared.remove', { defaultValue: 'Remove' })}
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>
            </div>

            {/* Company Information Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
                {t('companyAdmin.settings.companyInformation', { defaultValue: 'Company Information' })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.companyNameRequired', { defaultValue: 'Company Name *' })}
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.taxId', { defaultValue: 'Tax ID' })}
                  </label>
                  <Input
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder={t('companyAdmin.settings.taxIdPlaceholder', { defaultValue: 'e.g., 123456789' })}
                    disabled // Read-only for now as backend doesn't support update
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.address', { defaultValue: 'Address' })}
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t('companyAdmin.settings.addressPlaceholder', { defaultValue: 'Company address' })}
                    disabled // Read-only for now
                  />
                </div>
              </div>
            </div>

            {/* Financial Settings Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
                {t('companyAdmin.settings.financialSettings', { defaultValue: 'Financial Settings' })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.baseCurrencyRequired', { defaultValue: 'Base Currency *' })}
                  </label>
                  <select
                    value={formData.baseCurrency}
                    onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">{t('companyAdmin.settings.selectCurrency', { defaultValue: 'Select currency' })}</option>
                    {CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code} - {currencyDisplayNames.of(code) || code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.fiscalYearStartMonth', { defaultValue: 'Fiscal Year Start Month' })}
                  </label>
                  <select
                    value={formData.fiscalYearStart}
                    onChange={(e) => setFormData({ ...formData, fiscalYearStart: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>
                        {monthFormatter.format(new Date(2020, m.value - 1, 1))}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.fiscalYearEndMonth', { defaultValue: 'Fiscal Year End Month' })}
                  </label>
                  <select
                    value={formData.fiscalYearEnd}
                    onChange={(e) => setFormData({ ...formData, fiscalYearEnd: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>
                        {monthFormatter.format(new Date(2020, m.value - 1, 1))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Subscription Info (Read-only) */}
            {profile && (
              <div>
                <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
                  {t('companyAdmin.settings.subscription', { defaultValue: 'Subscription' })}
                </h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{t('companyAdmin.settings.currentPlan', { defaultValue: 'Current Plan' })}</p>
                      <p className="text-lg font-semibold capitalize">{profile.subscriptionPlan}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.location.href = '/company-admin/bundles'}
                    >
                      {t('companyAdmin.settings.manageSubscription', { defaultValue: 'Manage Subscription' })}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time Settings Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
                {t('companyAdmin.settings.dateTimeSettings', { defaultValue: 'Date & Time Settings' })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.companyTimezoneRequired', { defaultValue: 'Company Timezone *' })}
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.value} ({tz.offset})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.preferredDateFormatRequired', { defaultValue: 'Preferred Date Format *' })}
                  </label>
                  <select
                    value={formData.dateFormat}
                    onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {DATE_FORMAT_OPTIONS.map((fmt) => (
                      <option key={fmt.value} value={fmt.value}>
                        {fmt.value} (e.g. {fmt.example})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('companyAdmin.settings.systemLanguageRequired', { defaultValue: 'System Language *' })}
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="en">{t('language.english', { defaultValue: 'English' })}</option>
                    <option value="ar">{t('language.arabic', { defaultValue: 'Arabic' })}</option>
                    <option value="tr">{t('language.turkish', { defaultValue: 'Turkish' })}</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 italic font-medium">
                {t('companyAdmin.settings.dateSettingsHint', {
                  defaultValue: 'These settings will affect how dates are displayed across all company reports and vouchers.',
                })}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                disabled={isUpdating}
              >
                {t('companyAdmin.shared.reset', { defaultValue: 'Reset' })}
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating
                  ? t('companyAdmin.shared.saving', { defaultValue: 'Saving...' })
                  : t('companyAdmin.shared.saveChanges', { defaultValue: 'Save Changes' })}
              </Button>
            </div>
          </form>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 mt-6 border-red-200">
          <h3 className="text-lg font-semibold text-red-600 mb-4">{t('companyAdmin.settings.dangerZone', { defaultValue: 'Danger Zone' })}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-md">
              <div>
                <p className="font-medium text-gray-900">{t('companyAdmin.settings.deleteCompany', { defaultValue: 'Delete Company' })}</p>
                <p className="text-sm text-gray-600">
                  {t('companyAdmin.settings.deleteCompanyHint', {
                    defaultValue: 'Permanently delete this company and all associated data',
                  })}
                </p>
              </div>
              <Button variant="secondary" className="text-red-600 border-red-300 hover:bg-red-50">
                {t('companyAdmin.settings.deleteCompany', { defaultValue: 'Delete Company' })}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </CompanyAdminLayout>
  );
};

export default SettingsPage;
