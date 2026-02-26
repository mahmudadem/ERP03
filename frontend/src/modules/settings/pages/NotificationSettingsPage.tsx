import React, { useEffect, useState } from 'react';
import { Bell, Shield, Info, AlertTriangle, Database, Check, Loader2 } from 'lucide-react';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { errorHandler } from '../../../services/errorHandler';

const notificationCategories = [
  { id: 'APPROVAL', name: 'Financial Approvals', icon: <Shield className="w-5 h-5 text-indigo-500" />, desc: 'When a voucher requires your approval.' },
  { id: 'CUSTODY', name: 'Custody Confirmations', icon: <Database className="w-5 h-5 text-emerald-500" />, desc: 'When you are assigned as the custodian of an account in a transaction.' },
  { id: 'SYSTEM', name: 'System Info', icon: <Info className="w-5 h-5 text-blue-500" />, desc: 'General system notifications and non-critical updates.' },
  { id: 'WARNING', name: 'System Warnings', icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, desc: 'Alerts regarding system status, rejected vouchers, or other warnings.' }
];

export const NotificationSettingsPage: React.FC = () => {
  const { settings, updateSettings, isLoading } = useCompanySettings();
  const { company } = useCompanyAccess();
  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.disabledNotificationCategories) {
      setDisabledCategories(settings.disabledNotificationCategories);
      return;
    }
    setDisabledCategories([]);
  }, [settings?.disabledNotificationCategories]);

  const handleToggle = (categoryId: string) => {
    setDisabledCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(c => c !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ disabledNotificationCategories: disabledCategories });
      errorHandler.showSuccess('Company notification defaults saved');
    } catch (error) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="animate-spin w-6 h-6" /></div>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-500" />
            Company Notification Defaults
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Default notification policy for all users in {company?.name || 'this company'}.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
          Save Company Defaults
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Event Categories</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pb-1">
            Disable categories here to turn them off by default for all users in this company. Users can still override these defaults in their profile.
          </p>
        </div>
        
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {notificationCategories.map(cat => {
            const isEnabled = !disabledCategories.includes(cat.id);
            return (
              <div key={cat.id} className="p-6 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-700 rounded-lg shrink-0">
                   {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cat.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{cat.desc}</p>
                </div>
                <div className="ml-4 shrink-0 mt-1">
                  {/* Accessible Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`${cat.name} notifications`}
                    onClick={() => handleToggle(cat.id)}
                    className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                      isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute left-0.5 top-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
