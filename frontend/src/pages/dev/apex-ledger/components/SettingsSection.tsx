import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  ArrowUpRight,
  CalendarDays,
  DollarSign,
  Shield,
  Bell,
  Globe,
  BookOpen,
} from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    id: 'general',
    name: 'General',
    nameAr: 'الإعدادات العامة',
    desc: 'Fiscal year, company name, base currency',
    icon: Globe,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    legacyPath: '/accounting/settings',
  },
  {
    id: 'fiscal',
    name: 'Fiscal Calendar',
    nameAr: 'السنة المالية',
    desc: 'Period management, fiscal year setup, period locking',
    icon: CalendarDays,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    legacyPath: '/accounting/settings',
  },
  {
    id: 'currency',
    name: 'Currency & Exchange',
    nameAr: 'العملات وأسعار الصرف',
    desc: 'Multi-currency settings, exchange rate policies',
    icon: DollarSign,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    legacyPath: '/accounting/settings',
  },
  {
    id: 'approval',
    name: 'Approval Workflows',
    nameAr: 'سير عمل الموافقات',
    desc: 'Voucher approval chains, posting authority settings',
    icon: Shield,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    legacyPath: '/accounting/settings',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    nameAr: 'الإشعارات',
    desc: 'Alert thresholds, budget alerts, period-close reminders',
    icon: Bell,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    legacyPath: '/accounting/settings',
  },
  {
    id: 'coa-settings',
    name: 'Chart of Accounts Config',
    nameAr: 'إعدادات شجرة الحسابات',
    desc: 'COA numbering scheme, account classification defaults',
    icon: BookOpen,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    legacyPath: '/accounting/settings',
  },
];

export default function SettingsSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getSectionKey = (id: string): string => {
    switch (id) {
      case 'general': return 'apex.settings.generalSettings';
      case 'fiscal': return 'apex.settings.fiscalYear';
      case 'currency': return 'apex.settings.currenciesExchange';
      case 'approval': return 'apex.settings.approvalWorkflow';
      case 'notifications': return 'apex.settings.notifications';
      case 'coa-settings': return 'apex.settings.coaSettings';
      default: return 'apex.settings.accountingSettings';
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{t('apex.settings.accountingSettings', { defaultValue: 'Accounting Settings' })}</h2>
          <p className="text-[10px] text-slate-500">Configure fiscal periods, approval rules, currencies, and more</p>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const translatedName = t(getSectionKey(section.id), { defaultValue: section.name });
          return (
            <button
              key={section.id}
              onClick={() => navigate(section.legacyPath)}
              className="bg-white border border-[#E2E8F0] p-4 rounded-lg hover:border-slate-400 hover:shadow-sm transition-all duration-200 text-left group"
            >
              <div className={`w-9 h-9 rounded-lg ${section.bgColor} flex items-center justify-center ${section.color} mb-3 group-hover:scale-105 transition-transform`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-[10px] font-bold text-slate-700 leading-tight">{translatedName}</h3>
              <h4 className={`text-[10px] font-semibold ${section.color} mb-1 leading-tight`}>{section.name}</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">{section.desc}</p>
              <div className="mt-3 flex items-center space-x-1 text-[10px] font-semibold text-slate-500 group-hover:text-blue-600 transition-colors">
                <span>{t('common.configure', { defaultValue: 'Configure' })}</span>
                <ArrowUpRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Direct link to full settings */}
      <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="text-white">
          <h3 className="text-xs font-bold">{t('apex.settings.fullSettings', { defaultValue: 'Full Accounting Settings' })}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Open the complete settings page in the main application</p>
        </div>
        <button
          onClick={() => navigate('/accounting/settings')}
          className="flex items-center space-x-2 bg-white text-slate-800 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <span>{t('apex.settings.openSettings', { defaultValue: 'Open Settings' })}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
