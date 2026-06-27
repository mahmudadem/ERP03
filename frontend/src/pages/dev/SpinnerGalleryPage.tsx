import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Copy, Palette, Eye, Code, Scale, Coins, FileSpreadsheet, Percent, Calculator, TrendingUp, Sparkles, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import i18n from "i18next";

// --- SPINNER OPTIONS COMPONENTS ---

// 1. Classic Loader2
const Option1Loader2: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <svg className={`animate-spin ${size} ${color}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

// 2. Stripe-style Gradient Sweep
const OptionGradientSweep: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`relative ${size} flex items-center justify-center`}>
      <svg className={`animate-spin w-full h-full ${color}`} viewBox="0 0 32 32">
        <defs>
          <linearGradient id="gradient-sweep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" stroke="url(#gradient-sweep)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
};

// 3. Double Orbiting Balls (3D Effect)
const OptionDualOrbit: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`relative ${size} ${color} flex items-center justify-center`}>
      <div className="absolute w-full h-full border border-current opacity-10 rounded-full" />
      <div className="absolute w-full h-full animate-spin">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-current opacity-50" />
      </div>
    </div>
  );
};

// 4. Linear-style Fading Segments
const OptionFadingSegments: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`relative ${size} ${color} flex items-center justify-center`}>
      <svg className="animate-spin w-full h-full" viewBox="0 0 24 24" fill="none">
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = i * 45;
          const opacity = 0.15 + (i * 0.85) / 7;
          return (
            <line
              key={i}
              x1="12"
              y1="4"
              x2="12"
              y2="8"
              transform={`rotate(${angle} 12 12)`}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity={opacity}
            />
          );
        })}
      </svg>
    </div>
  );
};

// 5. Concentric Pulse Radar
const OptionRadarPulse: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`relative ${size} ${color} flex items-center justify-center`}>
      <div className="absolute w-full h-full rounded-full border-2 border-current animate-ping opacity-40" />
      <div className="absolute w-2/3 h-2/3 rounded-full border-2 border-current animate-ping opacity-60 [animation-delay:0.5s]" />
      <div className="w-4 h-4 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
    </div>
  );
};

// 6. Liquid Orbit Ring
const OptionLiquidOrbit: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`relative ${size} flex items-center justify-center`}>
      <svg className={`animate-spin absolute inset-0 ${color}`} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="opacity-10" />
        <path d="M12 2A10 10 0 0 0 2 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className="opacity-95" />
      </svg>
    </div>
  );
};

// --- ACCOUNTING THEMED OPTION COMPONENTS ---
const OptionAcctScale: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`${size} ${color} flex items-center justify-center relative`}>
      <Scale className="w-full h-full animate-bounce" style={{ animationDuration: '2s' }} />
      <div className="absolute inset-0 border border-current rounded-full opacity-10 animate-pulse" />
    </div>
  );
};

const OptionAcctCoins: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`${size} ${color} flex items-center justify-center relative`}>
      <Coins className="w-full h-full animate-bounce" style={{ animationDuration: '1.8s' }} />
      <div className="absolute inset-0 border border-current rounded-full opacity-10 animate-pulse" />
    </div>
  );
};

const OptionAcctLedger: React.FC<{ size: string; color: string }> = ({ size, color }) => {
  return (
    <div className={`${size} ${color} flex items-center justify-center relative`}>
      <FileSpreadsheet className="w-full h-full animate-pulse" />
      <div className="absolute inset-0 border-2 border-dashed border-current rounded-full animate-spin" style={{ animationDuration: '6s' }} />
    </div>
  );
};

export const SpinnerGalleryPage: React.FC = () => {
    const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [selectedBg, setSelectedBg] = useState<'light' | 'dark' | 'slate'>('light');
  const [selectedSize, setSelectedSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');
  const [selectedColor, setSelectedColor] = useState<'indigo' | 'emerald' | 'amber' | 'slate' | 'rose'>('indigo');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-500 dark:text-amber-400',
    slate: 'text-slate-900 dark:text-slate-100',
    rose: 'text-rose-600 dark:text-rose-400',
  };

  const bgClasses = {
    light: 'bg-white border-slate-200',
    dark: 'bg-slate-950 border-slate-800 text-slate-100',
    slate: 'bg-slate-50 border-slate-200',
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success(i18n.t('Code copied to clipboard!'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const premiumOptions = [
    {
      id: 'gradient_sweep',
      name: 'Premium Option A: Smooth Gradient Sweep',
      description: 'Conic/linear fading gradient ring. High-end modern SaaS look (similar to Stripe or Linear). Feels clean, fluid, and highly polished.',
      component: <OptionGradientSweep size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="gradient-sweep" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
      <stop offset="50%" stopColor="currentColor" stopOpacity="0.4" />
      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="14" stroke="url(#gradient-sweep)" strokeWidth="3" fill="none" strokeLinecap="round" />
</svg>`
    },
    {
      id: 'dual_orbit',
      name: 'Premium Option B: Dual Orbiting Spheres',
      description: 'Two glowing spheres orbiting at opposite coordinates. Creates a beautiful 3D balance and kinetic movement.',
      component: <OptionDualOrbit size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<div className="relative h-8 w-8 text-indigo-600 flex items-center justify-center">
  <div className="absolute w-full h-full border border-current opacity-10 rounded-full" />
  <div className="absolute w-full h-full animate-spin">
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-current opacity-50" />
  </div>
</div>`
    },
    {
      id: 'fading_segments',
      name: 'Premium Option C: Linear Fading Radial lines',
      description: 'An elegant wheel of fading tick segments. Similar to iOS/macOS system loaders. Feels organic, technical, and precise.',
      component: <OptionFadingSegments size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
  {Array.from({ length: 8 }).map((_, i) => (
    <line key={i} x1="12" y1="4" x2="12" y2="8" transform={\`rotate(\${i * 45} 12 12)\`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity={0.15 + (i * 0.85) / 7} />
  ))}
</svg>`
    },
    {
      id: 'radar_pulse',
      name: 'Premium Option D: Radar Pulse Rings',
      description: 'Concentric circular waves pulsing outwards. Best for tracking processes, status updates, or fetching live APIs.',
      component: <OptionRadarPulse size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<div className="relative h-8 w-8 text-indigo-600 flex items-center justify-center">
  <div className="absolute w-full h-full rounded-full border-2 border-current animate-ping opacity-40" />
  <div className="absolute w-2/3 h-2/3 rounded-full border-2 border-current animate-ping opacity-60 [animation-delay:0.5s]" />
  <div className="w-4 h-4 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
</div>`
    },
    {
      id: 'liquid_orbit',
      name: 'Premium Option E: Liquid Orbit Loop',
      description: 'A smooth thick arc chasing its tail on a thin track. Modern SaaS look that feels alive and interactive.',
      component: <OptionLiquidOrbit size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<div className="relative h-8 w-8 flex items-center justify-center">
  <svg className="animate-spin absolute inset-0 text-indigo-600" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="opacity-10" />
    <path d="M12 2A10 10 0 0 0 2 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className="opacity-95" />
  </svg>
</div>`
    },
    {
      id: 'option1',
      name: 'Premium Option F: Core Modern Loop',
      description: 'Lightweight circular segment rotating smoothly. Clean, standard, and highly optimized.',
      component: <Option1Loader2 size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
</svg>`
    }
  ];

  const acctOptions = [
    {
      id: 'acct_scale',
      name: 'Accounting Option A: Balancing Scale',
      description: 'A bouncing balancing scale. Highly literal metaphor for ledger reconciliation and trial balances.',
      component: <OptionAcctScale size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<div className="w-8 h-8 text-indigo-600 flex items-center justify-center relative">
  <Scale className="w-full h-full animate-bounce" style={{ animationDuration: '2s' }} />
  <div className="absolute inset-0 border border-current rounded-full opacity-10 animate-pulse" />
</div>`
    },
    {
      id: 'acct_coins',
      name: 'Accounting Option B: Floating Coin Pulse',
      description: 'Stacking coin visuals representing currency transactions, cash entries, and payment syncs.',
      component: <OptionAcctCoins size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<div className="w-8 h-8 text-indigo-600 flex items-center justify-center relative">
  <Coins className="w-full h-full animate-bounce" style={{ animationDuration: '1.8s' }} />
  <div className="absolute inset-0 border border-current rounded-full opacity-10 animate-pulse" />
</div>`
    },
    {
      id: 'acct_ledger',
      name: 'Accounting Option C: Ledger sheet Rotation',
      description: 'Ledger table spreadsheet with a rotating dash ring. Very distinct for journal voucher loading.',
      component: <OptionAcctLedger size={sizeClasses[selectedSize]} color={colorClasses[selectedColor]} />,
      code: `<div className="w-8 h-8 text-indigo-600 flex items-center justify-center relative">
  <FileSpreadsheet className="w-full h-full animate-pulse" />
  <div className="absolute inset-0 border-2 border-dashed border-current rounded-full animate-spin" style={{ animationDuration: '6s' }} />
</div>`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dev/ui-lab')}
            className="p-2 hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" /> Premium Spinner Options
            </h1>
            <p className="text-sm text-slate-500">{t(`Preview and select the unified loading spinner styling for the application.`)}</p>
          </div>
        </div>
      </div>

      {/* Customizer Tray */}
      <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-wrap gap-8 items-center">
        {/* Background Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
            <Palette className="w-3.5 h-3.5" /> Background Theme
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['light', 'dark', 'slate'] as const).map((bg) => (
              <button
                key={bg}
                onClick={() => setSelectedBg(bg)}
                className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors ${
                  selectedBg === bg ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Color Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
            <Palette className="w-3.5 h-3.5" /> Color Palette
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['indigo', 'emerald', 'amber', 'slate', 'rose'] as const).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors ${
                  selectedColor === color ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>

        {/* Size Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Preview Size
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-3 py-1 text-xs font-bold rounded-md uppercase transition-colors ${
                  selectedSize === size ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* SECTION 1: PREMIUM MODERN LOADERS */}
      <div className="space-y-4">
        <h2 className="text-md font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" /> Premium Modern Loader Options
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {premiumOptions.map((opt) => (
            <Card key={opt.id} className="bg-white border border-slate-200 overflow-hidden flex flex-col shadow-sm">
              <div className={`h-40 flex items-center justify-center border-b border-slate-100 transition-all ${bgClasses[selectedBg]}`}>
                <div className="transform scale-150">
                  {opt.component}
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm">{opt.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                      <Code className="w-3 h-3" /> JSX Code
                    </span>
                    <button
                      onClick={() => handleCopyCode(opt.id, opt.code)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {copiedId === opt.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono p-3 bg-slate-950 text-slate-300 rounded-lg overflow-x-auto max-h-24 custom-scroll border border-slate-800">
                    {opt.code}
                  </pre>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* SECTION 2: ACCOUNTING THEMED LOADERS */}
      <div className="space-y-4 pt-4">
        <h2 className="text-md font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-500" /> Accounting & Financial Themed Loaders
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {acctOptions.map((opt) => (
            <Card key={opt.id} className="bg-white border border-slate-200 overflow-hidden flex flex-col shadow-sm">
              <div className={`h-40 flex items-center justify-center border-b border-slate-100 transition-all ${bgClasses[selectedBg]}`}>
                <div className="transform scale-150">
                  {opt.component}
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm">{opt.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                      <Code className="w-3 h-3" /> JSX Code
                    </span>
                    <button
                      onClick={() => handleCopyCode(opt.id, opt.code)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {copiedId === opt.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono p-3 bg-slate-950 text-slate-300 rounded-lg overflow-x-auto max-h-24 custom-scroll border border-slate-800">
                    {opt.code}
                  </pre>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
export default SpinnerGalleryPage;
