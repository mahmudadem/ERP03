import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wrench,
  Layout,
  PiggyBank,
  Tags,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';

interface ToolsSectionProps {
  activeTool?: string;
}

const TOOLS = [
  {
    id: 'forms',
    name: 'Forms Management',
    nameAr: 'إدارة النماذج',
    desc: 'Design, customize, and manage voucher templates for your company',
    icon: Layout,
    legacyPath: '/accounting/tools/voucher-designer',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'budgets',
    name: 'Budgets',
    nameAr: 'الميزانيات التقديرية',
    desc: 'Set up and manage annual budgets by cost center or account',
    icon: PiggyBank,
    legacyPath: '/accounting/budgets',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    id: 'subgroup-tagging',
    name: 'Subgroup Tagging',
    nameAr: 'تعليمات المجموعات الفرعية',
    desc: 'Tag accounts with analytical subgroups for advanced reporting',
    icon: Tags,
    legacyPath: '/accounting/settings/subgroup-tagging',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
];

export default function ToolsSection({ activeTool }: ToolsSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getToolKey = (id: string): string => {
    switch (id) {
      case 'forms': return 'apex.tools.formsManagement';
      case 'budgets': return 'apex.tools.budgets';
      case 'subgroup-tagging': return 'apex.tools.subgroupTagging';
      default: return 'sidebar.tools';
    }
  };

  if (activeTool) {
    const tool = TOOLS.find(t => t.id === activeTool);
    if (tool) {
      const Icon = tool.icon;
      return (
        <div className="space-y-4 font-sans">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <button onClick={() => navigate('/dev/apex-ledger/tools')} className="hover:text-blue-600 transition-colors">
              {t('sidebar.tools', { defaultValue: 'Tools' })}
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-800 font-semibold">{t(getToolKey(tool.id), { defaultValue: tool.name })}</span>
          </div>

          <div className={`${tool.bgColor} border border-[#E2E8F0] rounded-lg p-5 flex items-center justify-between`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center ${tool.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${tool.color}`}>{t(getToolKey(tool.id), { defaultValue: tool.name })}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{tool.desc}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(tool.legacyPath)}
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-md border ${tool.bgColor} ${tool.color} border-current hover:opacity-80`}
            >
              <span>{t('apex.tools.openFull', { defaultValue: 'Open Full Tool' })}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg min-h-[300px] flex flex-col items-center justify-center space-y-4 p-8">
            <div className={`w-14 h-14 ${tool.bgColor} rounded-2xl flex items-center justify-center ${tool.color}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800">{tool.name}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">{tool.desc}</p>
            </div>
            <p className="text-xs text-slate-400 bg-slate-50 rounded px-3 py-2 border border-slate-200 text-center">
              Apex-styled tool renderer — Phase 4 deliverable
            </p>
            <button
              onClick={() => navigate(tool.legacyPath)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Open in Full App</span>
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="space-y-5 font-sans">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
          <Wrench className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{t('apex.tools.accountingTools', { defaultValue: 'Accounting Tools' })}</h2>
          <p className="text-[10px] text-slate-500">Configure forms, budgets, and analytical tagging</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const translatedName = t(getToolKey(tool.id), { defaultValue: tool.name });
          return (
            <button
              key={tool.id}
              onClick={() => navigate(`/dev/apex-ledger/tools/${tool.id}`)}
              className="bg-white border border-[#E2E8F0] p-5 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-left group"
            >
              <div className={`w-10 h-10 rounded-lg ${tool.bgColor} flex items-center justify-center ${tool.color} mb-3 group-hover:scale-105 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">{translatedName}</h3>
              <h4 className={`text-xs font-semibold ${tool.color} mb-1`}>{tool.name}</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">{tool.desc}</p>
              <div className="mt-3 flex items-center space-x-1 text-[10px] font-semibold text-blue-600 group-hover:underline">
                <span>{t('common.open', { defaultValue: 'Open' })}</span>
                <ArrowUpRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
