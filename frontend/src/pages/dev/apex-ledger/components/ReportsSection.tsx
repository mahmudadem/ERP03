import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  ScrollText,
  BookMinus,
  BookOpen,
  PieChart,
  Waves,
  BookMarked,
  Clock3,
  Landmark,
  Target,
  Scale,
  ArrowUpRight,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';

interface Report {
  name: string;
  nameAr: string;
  desc: string;
  icon: React.ComponentType<any>;
  legacyPath: string;
  apexPath: string;
  color: string;
  bgColor: string;
}

const REPORTS: Report[] = [
  {
    name: 'Trial Balance',
    nameAr: 'ميزان المراجعة',
    desc: 'Debit/credit summary across all accounts for a period',
    icon: BarChart3,
    legacyPath: '/accounting/reports/trial-balance',
    apexPath: '/dev/apex-ledger/reports/trial-balance',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    name: 'Account Statement',
    nameAr: 'كشف حساب',
    desc: 'Individual account ledger card with all transactions',
    icon: ScrollText,
    legacyPath: '/accounting/reports/account-statement',
    apexPath: '/dev/apex-ledger/reports/account-statement',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    name: 'Balance Sheet',
    nameAr: 'الميزانية العمومية',
    desc: 'Assets, liabilities, and equity position',
    icon: BookMinus,
    legacyPath: '/accounting/reports/balance-sheet',
    apexPath: '/dev/apex-ledger/reports/balance-sheet',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    name: 'General Ledger',
    nameAr: 'دفتر الأستاذ العام',
    desc: 'Full chronological posting history by account',
    icon: BookOpen,
    legacyPath: '/accounting/reports/ledger',
    apexPath: '/dev/apex-ledger/reports/ledger',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    name: 'Profit & Loss',
    nameAr: 'قائمة الأرباح والخسائر',
    desc: 'Revenue, cost, and net income for a period',
    icon: PieChart,
    legacyPath: '/accounting/reports/profit-loss',
    apexPath: '/dev/apex-ledger/reports/profit-loss',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    name: 'Trading Account',
    nameAr: 'حساب المتاجرة',
    desc: 'Gross profit, COGS, and sales margins',
    icon: FileSpreadsheet,
    legacyPath: '/accounting/reports/trading-account',
    apexPath: '/dev/apex-ledger/reports/trading-account',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    name: 'Cash Flow',
    nameAr: 'قائمة التدفقات النقدية',
    desc: 'Operating, investing, financing activities',
    icon: Waves,
    legacyPath: '/accounting/reports/cash-flow',
    apexPath: '/dev/apex-ledger/reports/cash-flow',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  {
    name: 'Journal',
    nameAr: 'سجل القيود اليومية',
    desc: 'Chronological journal entry log with debit/credit',
    icon: BookMarked,
    legacyPath: '/accounting/reports/journal',
    apexPath: '/dev/apex-ledger/reports/journal',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
  },
  {
    name: 'Aging Report',
    nameAr: 'تقرير الأعمار',
    desc: 'Receivables and payables aging by due date brackets',
    icon: Clock3,
    legacyPath: '/accounting/reports/aging',
    apexPath: '/dev/apex-ledger/reports/aging',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    name: 'Bank Reconciliation',
    nameAr: 'مطابقة البنك',
    desc: 'Match bank statement with book entries',
    icon: Landmark,
    legacyPath: '/accounting/reports/bank-reconciliation',
    apexPath: '/dev/apex-ledger/reports/bank-reconciliation',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
  },
  {
    name: 'Cost Center Summary',
    nameAr: 'ملخص مراكز التكلفة',
    desc: 'Revenue and expense breakdown by cost center',
    icon: Target,
    legacyPath: '/accounting/reports/cost-center-summary',
    apexPath: '/dev/apex-ledger/reports/cost-center-summary',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  {
    name: 'Budget vs Actual',
    nameAr: 'الميزانية مقابل الفعلي',
    desc: 'Variance analysis against approved budgets',
    icon: Scale,
    legacyPath: '/accounting/reports/budget-vs-actual',
    apexPath: '/dev/apex-ledger/reports/budget-vs-actual',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    name: 'Consolidated Trial Balance',
    nameAr: 'ميزان المراجعة الموحد',
    desc: 'Multi-entity consolidated trial balance view',
    icon: BarChart3,
    legacyPath: '/accounting/reports/consolidated-trial-balance',
    apexPath: '/dev/apex-ledger/reports/consolidated-tb',
    color: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-50',
  },
];

interface ReportsSectionProps {
  activeSubReport?: string;
}

export default function ReportsSection({ activeSubReport }: ReportsSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getReportKey = (name: string): string => {
    switch (name) {
      case 'Trial Balance': return 'apex.reports.trialBalance';
      case 'Account Statement': return 'apex.reports.accountStatement';
      case 'Balance Sheet': return 'apex.reports.balanceSheet';
      case 'General Ledger': return 'apex.reports.generalLedger';
      case 'Profit & Loss': return 'apex.reports.profitLoss';
      case 'Trading Account': return 'apex.reports.tradingAccount';
      case 'Cash Flow': return 'apex.reports.cashFlow';
      case 'Journal': return 'apex.reports.journal';
      case 'Aging Report': return 'apex.reports.aging';
      case 'Bank Reconciliation': return 'apex.reports.bankReconciliation';
      case 'Cost Center Summary': return 'apex.reports.costCenterSummary';
      case 'Budget vs Actual': return 'apex.reports.budgetVsActual';
      case 'Consolidated Trial Balance': return 'apex.reports.consolidatedTB';
      default: return 'sidebar.reports';
    }
  };

  // If a specific sub-report is active, show a "live preview" using an iframe or a message
  if (activeSubReport) {
    const report = REPORTS.find(r => {
      const slug = r.apexPath.split('/').pop();
      return slug === activeSubReport;
    });

    if (report) {
      const Icon = report.icon;
      return (
        <div className="space-y-4 font-sans">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <button
              onClick={() => navigate('/dev/apex-ledger/reports')}
              className="hover:text-blue-600 transition-colors"
            >
              {t('apex.reports.financialReports', { defaultValue: 'Financial Reports' })}
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-800 font-semibold">{t(getReportKey(report.name), { defaultValue: report.name })}</span>
          </div>

          {/* Report Header */}
          <div className={`${report.bgColor} border border-[#E2E8F0] rounded-lg p-5 flex items-center justify-between`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center ${report.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${report.color}`}>{t(getReportKey(report.name), { defaultValue: report.name })}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{report.desc}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(report.legacyPath)}
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-md border ${report.bgColor} ${report.color} border-current hover:opacity-80 transition-opacity`}
            >
              <span>{t('common.open', { defaultValue: 'Open' })}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Embedded iframe preview of the legacy report page */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 ml-2">apex-preview:{report.apexPath}</span>
            </div>
            <div className="p-6 text-center space-y-4 min-h-[350px] flex flex-col items-center justify-center">
              <div className={`w-16 h-16 ${report.bgColor} rounded-2xl flex items-center justify-center ${report.color} mx-auto`}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">{report.name}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">{report.desc}</p>
              </div>
              <p className="text-xs text-slate-400 bg-slate-50 rounded-md px-4 py-2 border border-slate-200">
                Apex-styled report renderer — Phase 4 deliverable
              </p>
              <button
                onClick={() => navigate(report.legacyPath)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm transition-all ${
                  report.color.includes('blue') ? 'bg-blue-600 hover:bg-blue-700' :
                  report.color.includes('indigo') ? 'bg-indigo-600 hover:bg-indigo-700' :
                  report.color.includes('violet') ? 'bg-violet-600 hover:bg-violet-700' :
                  report.color.includes('emerald') ? 'bg-emerald-600 hover:bg-emerald-700' :
                  report.color.includes('teal') ? 'bg-teal-600 hover:bg-teal-700' :
                  report.color.includes('amber') ? 'bg-amber-600 hover:bg-amber-700' :
                  report.color.includes('rose') ? 'bg-rose-600 hover:bg-rose-700' :
                  'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Open in Full App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Report Hub View (default)
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">{t('apex.reports.centerTitle', { defaultValue: 'Financial Reports & Queries Center' })}</h2>
            <p className="text-[10px] text-slate-500 font-mono">Financial Reports Center — {REPORTS.length} reports available</p>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map((r, idx) => {
          const Icon = r.icon;
          const translatedName = t(getReportKey(r.name), { defaultValue: r.name });
          return (
            <button
              key={idx}
              onClick={() => navigate(r.apexPath)}
              className="bg-white border border-[#E2E8F0] p-4 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-pointer flex items-start space-x-3 text-left group"
            >
              <div className={`w-9 h-9 rounded-lg ${r.bgColor} flex items-center justify-center ${r.color} shrink-0 group-hover:scale-105 transition-transform`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-800 leading-tight">{translatedName}</h4>
                    <h5 className={`text-[10px] font-semibold ${r.color} leading-tight`}>{r.name}</h5>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{r.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick access row */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 text-white flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider">{t('apex.reports.quickLaunch', { defaultValue: 'Quick Launch — Legacy Reports' })}</h3>
          <p className="text-[10px] text-blue-200 mt-0.5">{t('apex.reports.openDirectly', { defaultValue: 'Open directly in the full application' })}</p>
        </div>
        <div className="flex items-center space-x-2">
          {REPORTS.slice(0, 3).map((r, i) => {
            const Icon = r.icon;
            return (
              <button
                key={i}
                onClick={() => navigate(r.legacyPath)}
                title={r.name}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
          <button
            onClick={() => navigate('/accounting')}
            className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
          >
            <span>{t('common.all', { defaultValue: 'All' })}</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
