import React, { useState, useEffect, useRef } from 'react';
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

const t = (key: string) => key;

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const SettingsPage: React.FC = () => {
  const { profile, isLoading, updateProfile, isUpdating } = useCompanyProfile();
  const { settings, updateSettings } = useCompanySettings();
  const { theme, toggleTheme } = useUserPreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  
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
        title={t("companyAdmin.settings.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Settings' }]}
      />

      <div className="max-w-4xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Logo Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Company Logo</h3>
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
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">No Logo</p>
                    </div>
                  )}
                  {isProcessingLogo && (
                    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <p className="text-[10px] text-blue-600 mt-1 font-bold animate-pulse">Wait...</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-600">
                    This logo will appear on your dashboard, vouchers, and reports.
                    For best results, use a square image with a transparent background.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingLogo}
                    >
                      {formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {formData.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={removeLogo}
                      >
                        Remove
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
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax ID
                  </label>
                  <Input
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder="e.g., 123456789"
                    disabled // Read-only for now as backend doesn't support update
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Company address"
                    disabled // Read-only for now
                  />
                </div>
              </div>
            </div>

            {/* Financial Settings Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Financial Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Currency *
                  </label>
                  <select
                    value={formData.baseCurrency}
                    onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select currency</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="TRY">TRY - Turkish Lira</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="EGP">EGP - Egyptian Pound</option>
                    <option value="QAR">QAR - Qatari Rial</option>
                    <option value="KWD">KWD - Kuwaiti Dinar</option>
                    <option value="BHD">BHD - Bahraini Dinar</option>
                    <option value="OMR">OMR - Omani Rial</option>
                    <option value="JOD">JOD - Jordanian Dinar</option>
                    <option value="LBP">LBP - Lebanese Pound</option>
                    <option value="IQD">IQD - Iraqi Dinar</option>
                    <option value="SYP">SYP - Syrian Pound</option>
                    <option value="YER">YER - Yemeni Rial</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fiscal Year Start Month
                  </label>
                  <select
                    value={formData.fiscalYearStart}
                    onChange={(e) => setFormData({ ...formData, fiscalYearStart: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fiscal Year End Month
                  </label>
                  <select
                    value={formData.fiscalYearEnd}
                    onChange={(e) => setFormData({ ...formData, fiscalYearEnd: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Subscription Info (Read-only) */}
            {profile && (
              <div>
                <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Subscription</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Current Plan</p>
                      <p className="text-lg font-semibold capitalize">{profile.subscriptionPlan}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.location.href = '/company-admin/bundles'}
                    >
                      Manage Subscription
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time Settings Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Date & Time Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Timezone *
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="Europe/Istanbul">Istanbul (GMT+3)</option>
                    <option value="Europe/London">London (GMT+0/1)</option>
                    <option value="America/New_York">New York (GMT-5/4)</option>
                    <option value="Asia/Dubai">Dubai (GMT+4)</option>
                    <option value="Asia/Riyadh">Riyadh (GMT+3)</option>
                    <option value="Africa/Cairo">Cairo (GMT+2)</option>
                    <option value="Asia/Qatar">Qatar (GMT+3)</option>
                    <option value="Asia/Kuwait">Kuwait (GMT+3)</option>
                    <option value="Asia/Bahrain">Bahrain (GMT+3)</option>
                    <option value="Asia/Muscat">Muscat (GMT+4)</option>
                    <option value="Asia/Amman">Amman (GMT+3)</option>
                    <option value="Asia/Beirut">Beirut (GMT+2)</option>
                    <option value="Asia/Baghdad">Baghdad (GMT+3)</option>
                    <option value="Asia/Aden">Aden (GMT+3)</option>
                    <option value="Asia/Damascus">Damascus (GMT+3)</option>
                    <option value="Asia/Hebron">Hebron (GMT+2)</option>
                    <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                    <option value="Asia/Shanghai">Shanghai (GMT+8)</option>
                    <option value="Asia/Singapore">Singapore (GMT+8)</option>
                    <option value="Asia/Seoul">Seoul (GMT+9)</option>
                    <option value="Australia/Sydney">Sydney (GMT+11)</option>
                    <option value="Europe/Berlin">Berlin (GMT+1)</option>
                    <option value="Europe/Paris">Paris (GMT+1)</option>
                    <option value="Europe/Madrid">Madrid (GMT+1)</option>
                    <option value="Europe/Rome">Rome (GMT+1)</option>
                    <option value="Europe/Moscow">Moscow (GMT+3)</option>
                    <option value="America/Toronto">Toronto (GMT-5)</option>
                    <option value="America/Sao_Paulo">Sao Paulo (GMT-3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Date Format *
                  </label>
                  <select
                    value={formData.dateFormat}
                    onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2025-12-31)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 31/12/2025)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 12/31/2025)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="en">English (US)</option>
                    <option value="ar">Arabic (العربية)</option>
                    <option value="tr">Turkish (Türkçe)</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 italic font-medium">
                These settings will affect how dates are displayed across all company reports and vouchers.
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
                Reset
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 mt-6 border-red-200">
          <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-md">
              <div>
                <p className="font-medium text-gray-900">Delete Company</p>
                <p className="text-sm text-gray-600">
                  Permanently delete this company and all associated data
                </p>
              </div>
              <Button variant="secondary" className="text-red-600 border-red-300 hover:bg-red-50">
                Delete Company
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </CompanyAdminLayout>
  );
};

export default SettingsPage;
