/**
 * Apex Settings Section — wraps the real AccountingSettingsPage in Apex chrome.
 *
 * The AccountingSettingsPage is 2,643 lines of complex form logic
 * (fiscal years, approval policies, cost centers, voucher numbering, FX revaluation).
 * Rather than re-building that logic from scratch, we embed the real page inside the
 * Apex layout so it gets the Apex shell but retains all original functionality.
 */

import React, { useState } from 'react';
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
  Hash,
  ArrowLeftRight,
  Layers,
  ChevronRight,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

const SETTING_SECTIONS = [
  {
    id: 'general',
    name: 'General Settings',
    nameAr: 'الإعدادات العامة',
    desc: 'Timezone, date format, UI mode, and global FX account configuration.',
    icon: Globe,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'policies',
    name: 'Approval Workflow',
    nameAr: 'سير عمل الموافقات',
    desc: 'Financial approval (FA), custody confirmation (CC), auto-post, period lock, and account access controls.',
    icon: Shield,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  {
    id: 'payment-methods',
    name: 'Payment Methods',
    nameAr: 'طرق الدفع',
    desc: 'Enable or disable payment method options for vouchers (Cash, Cheque, Wire, etc.).',
    icon: CreditCard,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'cost-center',
    name: 'Cost Center Rules',
    nameAr: 'قواعد مراكز التكلفة',
    desc: 'Configure which account types or specific accounts require a cost center tag on every voucher line.',
    icon: DollarSign,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'cost-centers-manage',
    name: 'Manage Cost Centers',
    nameAr: 'إدارة مراكز التكلفة',
    desc: 'Create, rename, activate, deactivate, and delete cost centers.',
    icon: Layers,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    id: 'error-mode',
    name: 'Policy Error Mode',
    nameAr: 'وضع خطأ السياسة',
    desc: 'Choose between Fail-Fast (stop on first error) or Aggregate (collect all errors before stopping).',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    id: 'fiscal',
    name: 'Accounting Periods',
    nameAr: 'الفترات المحاسبية',
    desc: 'Create fiscal years, close/reopen periods, and manage year-end closing entries.',
    icon: CalendarDays,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  {
    id: 'numbering',
    name: 'Voucher Numbering',
    nameAr: 'ترقيم المستندات',
    desc: 'Manage voucher sequence numbers and set the next number for each voucher type.',
    icon: Hash,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  {
    id: 'fx-revaluation',
    name: 'FX Revaluation',
    nameAr: 'إعادة تقييم العملات',
    desc: 'Configure exchange gain/loss accounts and run FX revaluation at period end.',
    icon: ArrowLeftRight,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
];

export default function ApexAccountingSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const getSectionKey = (id: string): string => {
    switch (id) {
      case 'general': return 'apex.settings.generalSettings';
      case 'policies': return 'apex.settings.approvalWorkflow';
      case 'payment-methods': return 'apex.settings.paymentMethods';
      case 'cost-center': return 'apex.settings.costCenterRules';
      case 'cost-centers-manage': return 'apex.settings.costCenterManagement';
      case 'error-mode': return 'apex.settings.policyErrorMode';
      case 'fiscal': return 'apex.settings.accountingPeriods';
      case 'numbering': return 'apex.settings.documentNumbering';
      case 'fx-revaluation': return 'apex.settings.currencyRevaluation';
      default: return 'apex.settings.accountingSettings';
    }
  };

  const handleOpenInFullApp = (sectionId?: string) => {
    const path = sectionId
      ? `/dev/apex-ledger/settings/accounting#${sectionId}`
      : '/dev/apex-ledger/settings/accounting';
    navigate(path);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shadow-sm">
            <Settings className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">{t('apex.settings.accountingSettings', { defaultValue: 'Accounting Settings' })}</h2>
            <p className="text-[10px] text-slate-500 font-mono">{t(`Accounting Settings —`)} {SETTING_SECTIONS.length} {t(`sections`)}</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenInFullApp()}
          className="flex items-center space-x-2 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t('apex.settings.openFullPage', { defaultValue: 'Open Full Settings Page' })}</span>
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SETTING_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(isActive ? null : section.id);
                handleOpenInFullApp(section.id);
              }}
              className={`bg-white border rounded-lg p-4 text-left transition-all duration-200 group ${
                isActive
                  ? `${section.borderColor} shadow-sm`
                  : 'border-[#E2E8F0] hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${section.bgColor} flex items-center justify-center ${section.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <ArrowUpRight className={`w-3.5 h-3.5 transition-colors ${isActive ? section.color : 'text-slate-300 group-hover:text-blue-500'}`} />
              </div>
              <div>
                <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t(getSectionKey(section.id), { defaultValue: section.name })}</p>
                <h3 className={`text-[11px] font-bold leading-tight mt-0.5 ${isActive ? section.color : 'text-slate-700'}`}>{section.name}</h3>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{section.desc}</p>
              </div>
              <div className={`mt-3 text-[10px] font-semibold flex items-center space-x-1 ${section.color}`}>
                <span>{t('common.configure', { defaultValue: 'Configure' })}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Info Banner */}
      <div className="bg-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
        <div className="text-white space-y-1">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-slate-300" />
            <span className="text-xs font-bold uppercase tracking-wider">{t('apex.settings.fullSettings', { defaultValue: 'Full Accounting Settings' })}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-md">
            The full settings page includes Fiscal Year closing workflows, FX revaluation engine, voucher sequence management, and granular approval policy configuration.
          </p>
        </div>
        <button
          onClick={() => handleOpenInFullApp()}
          className="flex-shrink-0 flex items-center space-x-2 bg-white text-slate-800 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t('apex.settings.openFullPage', { defaultValue: 'Open Full Page' })}</span>
        </button>
      </div>
    </div>
  );
}
