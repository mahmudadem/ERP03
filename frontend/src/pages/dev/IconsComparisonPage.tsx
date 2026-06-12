import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Layers, Layout, Info, Sparkles, FolderTree, BookOpen, Scale, Landmark } from 'lucide-react';
import * as Icons from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { resolveSidebarIcon } from '../../components/navigation/sidebarIcons';

// Proposed Icon sets
const ICON_PACKAGES = [
  {
    id: 'classic',
    name: 'Set 1: Classic B2B (Traditional ERP)',
    description: 'Familiar, literal representations matching traditional ERP systems.',
    colorClass: 'from-slate-500 to-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50',
    themeColor: 'slate',
    borderClass: 'border-slate-200 dark:border-slate-800',
    icons: {
      accounting: 'HandCoins',
      inventory: 'Package',
      sales: 'ShoppingCart',
      purchase: 'ClipboardList',
      hr: 'Users',
      crm: 'Users',
      pos: 'Monitor',
      projects: 'Briefcase',
      ai: 'Bot',
      tools: 'Wrench'
    }
  },
  {
    id: 'modern_saas',
    name: 'Set 2: Modern SaaS (Cohesive & Active)',
    description: 'Premium modern SaaS icons representing active growth, banking integrity, and client relationship partnerships.',
    colorClass: 'from-indigo-500 to-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20',
    themeColor: 'indigo',
    borderClass: 'border-indigo-200 dark:border-indigo-900/50',
    icons: {
      accounting: 'Landmark',
      inventory: 'Boxes',
      sales: 'TrendingUp',
      purchase: 'ShoppingBag',
      hr: 'Contact',
      crm: 'HeartHandshake',
      pos: 'Store',
      projects: 'FolderKanban',
      ai: 'Sparkles',
      tools: 'Sliders'
    }
  },
  {
    id: 'financial_audit',
    name: 'Set 3: Financial & Audit Focus',
    description: 'Double-entry audit and cost-accounting representations focusing on ledgers and validation.',
    colorClass: 'from-emerald-500 to-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20',
    themeColor: 'emerald',
    borderClass: 'border-emerald-200 dark:border-emerald-900/50',
    icons: {
      accounting: 'Scale',
      inventory: 'Warehouse',
      sales: 'BadgeDollarSign',
      purchase: 'Receipt',
      hr: 'UserCheck',
      crm: 'Briefcase',
      pos: 'CreditCard',
      projects: 'CheckSquare',
      ai: 'Brain',
      tools: 'Settings2'
    }
  },
  {
    id: 'abstract_tech',
    name: 'Set 4: Abstract & Tech Forward',
    description: 'Modern, minimalist geometric representations for tech-forward digital products.',
    colorClass: 'from-violet-500 to-violet-700 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/20',
    themeColor: 'violet',
    borderClass: 'border-violet-200 dark:border-violet-900/50',
    icons: {
      accounting: 'Wallet',
      inventory: 'Layers',
      sales: 'Activity',
      purchase: 'Download',
      hr: 'Fingerprint',
      crm: 'Shuffle',
      pos: 'Calculator',
      projects: 'Kanban',
      ai: 'Cpu',
      tools: 'Hammer'
    }
  },
  {
    id: 'high_density',
    name: 'Set 5: Ultra-Minimalist',
    description: 'Lightweight line iconography for maximum density and low visual clutter.',
    colorClass: 'from-rose-500 to-rose-700 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20',
    themeColor: 'rose',
    borderClass: 'border-rose-200 dark:border-rose-900/50',
    icons: {
      accounting: 'DollarSign',
      inventory: 'Box',
      sales: 'Percent',
      purchase: 'ShoppingCart',
      hr: 'User',
      crm: 'Users2',
      pos: 'Tablet',
      projects: 'ListTodo',
      ai: 'Wand2',
      tools: 'Wrench'
    }
  },
  {
    id: 'custom_premium',
    name: 'Set 6: Selected Premium Layout',
    description: 'Custom tailored selection featuring custom colored trending clipboards and mechanical gears.',
    colorClass: 'from-amber-500 to-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
    themeColor: 'amber',
    borderClass: 'border-amber-200 dark:border-amber-900/50',
    icons: {
      accounting: 'Landmark',
      inventory: 'Warehouse',
      sales: 'ClipboardUpTrend',
      purchase: 'ClipboardDownTrend',
      hr: 'Users',
      crm: 'HeartHandshake',
      pos: 'Monitor',
      projects: 'Briefcase',
      ai: 'Bot',
      tools: '2gears'
    }
  }
];

const MODULE_LABELS: Record<string, string> = {
  accounting: 'Accounting',
  inventory: 'Inventory',
  sales: 'Sales',
  purchase: 'Purchases',
  hr: 'HR',
  crm: 'CRM',
  pos: 'POS',
  projects: 'Projects',
  ai: 'AI Assistant',
  tools: 'Tools'
};

const DynamicIcon = ({ name, className = 'w-5 h-5' }: { name: string; className?: string }) => {
  const IconComponent = resolveSidebarIcon(name);
  if (!IconComponent) {
    return <Icons.AlertCircle className={className} />;
  }
  return <IconComponent className={className} />;
};

export const IconsComparisonPage: React.FC = () => {
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState<string>('modern_saas');
  const [copied, setCopied] = useState(false);

  const selectedPreset = ICON_PACKAGES.find(p => p.id === activePreset) || ICON_PACKAGES[1];

  const handleCopyCode = () => {
    const codeString = JSON.stringify(selectedPreset.icons, null, 2);
    void navigator.clipboard.writeText(codeString);
    setCopied(true);
    toast.success('Icon mapping config copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Sidebar & Module Icons Playground</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare 5 different icon package aesthetics side-by-side or preview them dynamically in a mock sidebar drawer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ICON_PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => setActivePreset(pkg.id)}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-95',
                activePreset === pkg.id
                  ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-600/10'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              {pkg.name.split(':')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid comparing the packages */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Grid View (Left 3 Columns) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200">
              <Layers size={16} className="text-primary-500" />
              Side-by-Side Icon Packages Matrix
            </h2>
            
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-semibold">
                    <th className="p-4 w-40">Module</th>
                    {ICON_PACKAGES.map(pkg => (
                      <th
                        key={pkg.id}
                        className={clsx(
                          'p-4 w-52 transition-colors duration-200',
                          activePreset === pkg.id && 'bg-primary-500/5 dark:bg-primary-500/10 font-bold text-primary-600 dark:text-primary-400'
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span>{pkg.name.replace(/Set \d+: /, '')}</span>
                          <span className="text-[10px] font-normal text-slate-400 block max-w-[170px] whitespace-normal leading-tight">
                            {pkg.description}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.keys(MODULE_LABELS).map(modId => (
                    <tr key={modId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-300 capitalize">
                        {MODULE_LABELS[modId]}
                      </td>
                      {ICON_PACKAGES.map(pkg => {
                        const iconName = pkg.icons[modId as keyof typeof pkg.icons];
                        const isActive = activePreset === pkg.id;
                        return (
                          <td
                            key={pkg.id}
                            className={clsx(
                              'p-4 transition-colors duration-200',
                              isActive && 'bg-primary-500/5 dark:bg-primary-500/10'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={clsx(
                                'p-2.5 rounded-xl border flex items-center justify-center transition-all duration-300',
                                isActive 
                                  ? 'bg-white dark:bg-slate-800 shadow-sm border-primary-500/30 text-primary-600 dark:text-primary-400 scale-105' 
                                  : 'bg-slate-50/50 dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                              )}>
                                <DynamicIcon name={iconName} className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className={clsx('font-mono font-semibold', isActive ? 'text-primary-600 dark:text-primary-400 text-xs' : 'text-slate-400 text-[11px]')}>
                                  {iconName}
                                </span>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {modId}
                                </span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Sidebar Preview Drawer (Right 1 Column) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Preset Info */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Info size={16} className="text-primary-500" />
              Active Package Settings
            </h2>
            <div className="space-y-1">
              <p className="text-xs font-bold text-primary-600 dark:text-primary-400">{selectedPreset.name}</p>
              <p className="text-[11px] text-slate-400 leading-normal">{selectedPreset.description}</p>
            </div>
            
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">JSON Config:</span>
                <button
                  onClick={handleCopyCode}
                  className="text-primary-500 hover:text-primary-600 flex items-center gap-1 font-semibold transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 text-slate-300 p-2.5 rounded-xl text-[10px] font-mono overflow-x-auto max-h-40 border border-slate-800">
                {JSON.stringify(selectedPreset.icons, null, 2)}
              </pre>
            </div>
          </div>

          {/* Interactive Mock Sidebar Drawer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layout size={14} /> Mock Sidebar Preview
            </h2>
            
            <div className="rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-950 text-slate-200 p-3 min-h-[500px] flex flex-col justify-between font-sans">
              
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white font-black text-sm">
                    E
                  </div>
                  <div>
                    <h3 className="text-xs font-bold leading-tight">ERP03 Workspace</h3>
                    <span className="text-[9px] text-slate-400">Company Admin</span>
                  </div>
                </div>

                {/* Navigation Menu */}
                <div className="space-y-3">
                  {/* General */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block pl-2 mb-1">General</span>
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/40 text-slate-200 cursor-pointer">
                      <DynamicIcon name="Home" className="w-4 h-4 text-slate-400" />
                      <span>Home</span>
                    </div>
                  </div>

                  {/* Operational Modules */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block pl-2 mb-1">Modules</span>
                    
                    {/* Accounting */}
                    <div className="space-y-1.5 pl-1.5">
                      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900 cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <DynamicIcon name={selectedPreset.icons.accounting} className="w-4 h-4 text-primary-500" />
                          <span>Accounting</span>
                        </div>
                      </div>
                      <div className="pl-6 border-l border-slate-800 space-y-1">
                        <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-slate-400 hover:text-white cursor-pointer">
                          <FolderTree size={12} className="text-slate-500" />
                          <span>Chart of Accounts</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-slate-400 hover:text-white cursor-pointer">
                          <Scale size={12} className="text-slate-500" />
                          <span>Trial Balance</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-slate-400 hover:text-white cursor-pointer">
                          <BookOpen size={12} className="text-slate-500" />
                          <span>General Ledger</span>
                        </div>
                      </div>
                    </div>

                    {/* Inventory */}
                    <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <DynamicIcon name={selectedPreset.icons.inventory} className="w-4 h-4 text-slate-400" />
                        <span>Inventory</span>
                      </div>
                    </div>

                    {/* Sales */}
                    <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <DynamicIcon name={selectedPreset.icons.sales} className="w-4 h-4 text-slate-400" />
                        <span>Sales</span>
                      </div>
                    </div>

                    {/* Purchases */}
                    <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <DynamicIcon name={selectedPreset.icons.purchase} className="w-4 h-4 text-slate-400" />
                        <span>Purchases</span>
                      </div>
                    </div>

                    {/* CRM */}
                    <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <DynamicIcon name={selectedPreset.icons.crm} className="w-4 h-4 text-slate-400" />
                        <span>CRM</span>
                      </div>
                    </div>

                    {/* AI Assistant */}
                    <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <DynamicIcon name={selectedPreset.icons.ai} className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <span className="flex items-center gap-1">
                          <span>AI Agent</span>
                          <span className="text-[8px] bg-indigo-500/25 text-indigo-300 px-1 rounded font-bold">BETA</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Footer settings */}
              <div className="border-t border-slate-850 pt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer">
                  <DynamicIcon name={selectedPreset.icons.tools} className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-400 font-semibold hover:text-white transition-colors">Settings & Tools</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default IconsComparisonPage;
