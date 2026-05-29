import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { MockUnifiedSettingsPage } from '../../modules/settings/pages/MockUnifiedSettingsPage';
import {
  Sparkles,
  LayoutGrid,
  Settings,
  AlertCircle,
  CheckCircle2,
  Monitor,
  Landmark,
  Calendar,
  Clock,
  Sun,
  Moon,
  Bell,
  GripVertical,
  HelpCircle,
  RotateCcw,
  Check,
  Coins,
  ShieldCheck,
  FileText,
  MousePointer,
  Search
} from 'lucide-react';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useWidgetStore } from '../../store/widgetStore';

// Import real system widgets
import { ClockWidget } from '../../components/topbar/widgets/ClockWidget';
import { DateWidget } from '../../components/topbar/widgets/DateWidget';
import { FiscalYearWidget } from '../../components/topbar/widgets/FiscalYearWidget';
import { BaseCurrencyWidget } from '../../components/topbar/widgets/BaseCurrencyWidget';
import { ApprovalModeWidget } from '../../components/topbar/widgets/ApprovalModeWidget';
import { UIModeWidget } from '../../components/topbar/widgets/UIModeWidget';
import { NotesWidget } from '../../components/topbar/widgets/NotesWidget';
import { AlarmWidget } from '../../components/topbar/widgets/AlarmWidget';
import { CompanyLogoNameWidget } from '../../components/topbar/widgets/CompanyLogoNameWidget';
import { SearchWidget } from '../../components/topbar/widgets/SearchWidget';

export const UiLabDashboard: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const isRtl = React.useMemo(() => i18n.dir() === 'rtl', [i18n]);
  const [activeView, setActiveView] = useState<'widgets' | 'settings'>('widgets');
  const { theme } = useUserPreferences();
  const { widgets: storeWidgets, updateWidgetLayouts } = useWidgetStore();

  const getOrderedWidgets = React.useCallback(() => {
    const list = [...storeWidgets].sort((a, b) => a.layout.x - b.layout.x);
    const widgetMetadata: Record<string, { label: string; icon: any; color: string; bg: string }> = {
      'company-logo': { label: 'الشركة', icon: Landmark, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      'fiscal-year': { label: 'السنة المالية', icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
      'base-currency': { label: 'العملة', icon: Coins, color: 'text-amber-500', bg: 'bg-amber-500/10' },
      'approval-mode': { label: 'الاعتماد', icon: ShieldCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      'ui-mode': { label: 'الواجهة', icon: Monitor, color: 'text-sky-500', bg: 'bg-sky-500/10' },
      'date': { label: 'التاريخ', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
      'clock': { label: 'الوقت', icon: Clock, color: 'text-rose-500', bg: 'bg-rose-500/10' },
      'notes': { label: 'الملاحظات', icon: FileText, color: 'text-teal-500', bg: 'bg-teal-500/10' },
      'alarm': { label: 'التنبيهات', icon: Bell, color: 'text-orange-500', bg: 'bg-orange-500/10' },
      'search': { label: 'البحث', icon: Search, color: 'text-slate-450', bg: 'bg-slate-500/10' }
    };

    return list.map(w => {
      const meta = widgetMetadata[w.type] || { label: w.type, icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-500/10' };
      return {
        id: w.id,
        type: w.type,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        bg: meta.bg
      };
    });
  }, [storeWidgets]);

  const [widgets, setWidgets] = useState(getOrderedWidgets);
  const [activeDesignId, setActiveDesignId] = useState<number>(() => {
    return parseInt(localStorage.getItem('erp_topbar_widget_style') || '1', 10);
  });

  React.useEffect(() => {
    setWidgets(getOrderedWidgets());
  }, [getOrderedWidgets]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const reordered = [...widgets];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, removed);
    
    setWidgets(reordered);
    updateWidgetLayouts(
      reordered.map((w, i) => ({
        i: w.id,
        x: i * 10,
        y: 0,
        w: 12,
        h: 1
      }))
    );
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const resetWidgets = () => {
    const defaultOrder = ['company-logo', 'fiscal-year', 'base-currency', 'approval-mode', 'ui-mode', 'date', 'clock', 'notes', 'alarm', 'search'];
    const reordered = [...widgets].sort((a, b) => defaultOrder.indexOf(a.type) - defaultOrder.indexOf(b.type));
    setWidgets(reordered);
    updateWidgetLayouts(
      reordered.map((w, i) => ({
        i: w.id,
        x: i * 10,
        y: 0,
        w: 12,
        h: 1
      }))
    );
    toast.success('تمت إعادة تعيين الترتيب الافتراضي للنظام.');
  };

  // Render Real Widget Component
  const renderRealWidget = (type: string) => {
    switch (type) {
      case 'clock':
        return <ClockWidget showBorder={false} showBackground={false} showSeconds={false} compact={true} />;
      case 'date':
        return <DateWidget showBorder={false} showBackground={false} compact={true} />;
      case 'fiscal-year':
        return <FiscalYearWidget showBorder={false} showBackground={false} compact={true} />;
      case 'base-currency':
        return <BaseCurrencyWidget showBorder={false} showBackground={false} compact={true} />;
      case 'approval-mode':
        return <ApprovalModeWidget showBorder={false} showBackground={false} compact={true} />;
      case 'ui-mode':
        return <UIModeWidget showBorder={false} showBackground={false} compact={true} />;
      case 'notes':
        return <NotesWidget showBorder={false} showBackground={false} compact={true} />;
      case 'alarm':
        return <AlarmWidget showBorder={false} showBackground={false} compact={true} />;
      case 'company-logo':
        return <CompanyLogoNameWidget showBorder={false} showBackground={false} compact={true} />;
      case 'search':
        return <SearchWidget showBorder={false} showBackground={false} compact={true} />;
      default:
        return null;
    }
  };

  const designs = [
    {
      id: 1,
      nameAr: 'العرض المزدوج الرأسي المتكدس',
      nameEn: 'Design 1: Double-Decker Micro Cards',
      tag: 'المفضل الأول',
      tagColor: 'bg-teal-650 text-white',
      descAr: 'يقسم البطاقة الصغيرة إلى صفين رأسيين: العنوان الفرعي في الأعلى بالخط الباهت الصغير، والقيمة الفعلية في الأسفل بالخط العريض.',
      descEn: 'Stacked data widgets with small metadata labels placed above bold current values.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 select-none">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200/40 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-950/40 cursor-grab select-none min-w-[60px]"
              >
                <Icon className={clsx("w-2.5 h-2.5 shrink-0", w.color)} />
                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-tight truncate shrink-0">
                  {renderRealWidget(w.type)}
                </div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 2,
      nameAr: 'النظام الهندسي البرمجي (الترمينال)',
      nameEn: 'Design 2: Tech Terminal Brackets',
      tag: 'المفضل الثاني',
      tagColor: 'bg-amber-600 text-white',
      descAr: 'تصميم محاط بأقواس مربعة نصية مستوحى من واجهات الأوامر البرمجية. مناسب لشاشات لوحات القيادة والعمل التقني المباشر.',
      descEn: 'Tech brackets enclosing metadata (`[Value]`), mimicking code console dashboards.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 items-center font-mono text-[11px] select-none text-slate-500 dark:text-slate-400">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1 cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-indigo-500/85 font-black">[</span>
                <Icon className={clsx("w-3 h-3 shrink-0", w.color)} />
                <div className="leading-none shrink-0 text-slate-700 dark:text-slate-200">{renderRealWidget(w.type)}</div>
                <span className="text-indigo-500/85 font-black">]</span>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 3,
      nameAr: 'خطوط الفاصل العمودي',
      nameEn: 'Design 3: Pipeline Separators',
      tag: 'مفصول بخط pipeline واضح',
      tagColor: 'bg-indigo-600 text-white',
      descAr: 'تصميم يعتمد على فاصل خط عمودي عمودي (|) يفصل بين العناصر الفردية بشكل نظيف وبسيط بدون إطارات إضافية.',
      descEn: 'Clean minimalist layout with widget items separated by visible vertical pipeline characters (|).',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex items-center gap-1 select-none">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <React.Fragment key={w.id}>
                {index > 0 && <span className="text-slate-300 dark:text-slate-700 font-light px-1.5 text-sm select-none">|</span>}
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-305 cursor-grab active:cursor-grabbing hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors"
                >
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0", w.color)} />
                  <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )
    },
    {
      id: 5,
      nameAr: 'الكبسولة الفقاعية الموحدة',
      nameEn: 'Design 5: Bubble Pill',
      tag: 'عصري وناعم',
      tagColor: 'bg-violet-650 text-white',
      descAr: 'حاوية كبسولة ناعمة بخلفية ملونة شفافة وحدود دقيقة تليق بقيم الأقسام المختلفة.',
      descEn: 'Highly friendly capsules using distinct background colors corresponding to details.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 select-none py-1">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border cursor-grab transition-all text-xs font-bold text-slate-800 dark:text-slate-200 select-none shadow-xs hover:scale-102",
                  w.type === 'company-logo' && "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-900/30",
                  w.type === 'fiscal-year' && "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30",
                  w.type === 'base-currency' && "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30",
                  w.type === 'approval-mode' && "bg-purple-50/70 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-900/30",
                  w.type === 'ui-mode' && "bg-sky-50/70 dark:bg-sky-950/20 border-sky-200/50 dark:border-sky-900/30",
                  w.type === 'clock' && "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30",
                  w.type === 'date' && "bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-900/30",
                  w.type === 'notes' && "bg-teal-50/70 dark:bg-teal-950/20 border-teal-200/50 dark:border-teal-900/30",
                  w.type === 'alarm' && "bg-orange-50/70 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-900/30",
                  w.type === 'search' && "bg-slate-50/70 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/30"
                )}
              >
                <Icon className={clsx("w-3.5 h-3.5 shrink-0", w.color)} />
                <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 10,
      nameAr: 'الأشكال الهندسية المائلة',
      nameEn: 'Design 10: Slanted Skew',
      tag: 'مائل تقني عصري',
      tagColor: 'bg-emerald-600 text-white',
      descAr: 'تصميم ذو حواف وقصات هندسية مائلة بزاوية تعطي مظهراً ديناميكياً سريعاً وجريئاً للشركات المتقدمة.',
      descEn: 'Angled layout using modern CSS skew transformations to construct a dynamic header design.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 select-none py-1">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-100 dark:bg-slate-900 border-l-2 border-indigo-500 text-xs font-bold text-slate-700 dark:text-slate-250 cursor-grab transform -skew-x-12 hover:-translate-y-0.5 transition-all select-none"
              >
                <div className="transform skew-x-12 flex items-center gap-1.5 leading-none shrink-0">
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0", w.color)} />
                  <div>{renderRealWidget(w.type)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 11,
      nameAr: 'الإطارات المنقطة التقنية',
      nameEn: 'Design 11: Dotted Matrix',
      tag: 'منقط برمجي',
      tagColor: 'bg-cyan-500 text-white font-bold',
      descAr: 'تصميم يعتمد على إطار منقط دقيق مع مؤشر عددي لموقع العنصر، مستوحى من المخططات التقنية الصناعية.',
      descEn: 'Dotted frame layout representing system metrics with technical number pins.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 select-none py-1">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-dotted border-slate-350 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-250 cursor-grab select-none relative"
              >
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[7px] text-slate-500">
                  {index + 1}
                </span>
                <Icon className={clsx("w-3.5 h-3.5 shrink-0", w.color)} />
                <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 16,
      nameAr: 'بطاقات الخصم المثقوبة',
      nameEn: 'Design 16: Coupon Tag',
      tag: 'نمط البطاقة المثقوبة',
      tagColor: 'bg-rose-600 text-white',
      descAr: 'تصميم شارة يحاكي القصاصات الورقية المثقوبة من الأطراف، يعطي طابعاً فريداً ومميزاً للواجهات.',
      descEn: 'Creative ticket layouts punched with circular indents on both edges.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 select-none py-1">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-855 relative rounded cursor-grab shadow-xs font-bold text-xs text-slate-700 dark:text-slate-205"
              >
                <div className="absolute top-1/2 -left-1 w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-950 border-r border-slate-300 dark:border-slate-855 -translate-y-1/2" />
                <Icon className={clsx("w-3.5 h-3.5 shrink-0", w.color)} />
                <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                <div className="absolute top-1/2 -right-1 w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-950 border-l border-slate-300 dark:border-slate-855 -translate-y-1/2" />
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 17,
      nameAr: 'المخطط الهندسي المتقطع',
      nameEn: 'Design 17: Dashed Blueprint',
      tag: 'نمط تخطيطي برمجي',
      tagColor: 'bg-sky-500 text-white',
      descAr: 'شارات ذات حدود متقطعة ولون أزرق تخطيطي يشبه مخططات البناء البرمجية للمطورين والمهندسين.',
      descEn: 'Technical blueprint styles utilizing dashed boundaries and bright sky blue accents.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-2 select-none font-mono py-1">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-sky-450 bg-sky-50/10 text-sky-400 cursor-grab text-[10px]"
              >
                <Icon className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                <div className="font-bold leading-none shrink-0">{renderRealWidget(w.type)}</div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 18,
      nameAr: 'مؤشرات النقاط الملونة',
      nameEn: 'Design 18: State Dot Indicator',
      tag: 'مؤشرات ملونة نشطة',
      tagColor: 'bg-emerald-500 text-white',
      descAr: 'تصميم يعتمد على نقطة حالة مضيئة نابضة بجانب كل عنصر، مريح جداً للعين ويشبه شاشات المراقبة.',
      descEn: 'Pulsing status indicator dots attached to each widget card.',
      renderWidgets: (list: typeof widgets) => (
        <div className="flex gap-3 select-none py-1">
          {list.map((w, index) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 cursor-grab text-xs font-bold text-slate-700 dark:text-slate-250"
              >
                <span className={clsx("w-2 h-2 rounded-full shrink-0 animate-pulse", w.type === 'clock' || w.type === 'alarm' ? 'bg-red-500' : 'bg-emerald-500')} />
                <Icon className={clsx("w-3.5 h-3.5 shrink-0", w.color)} />
                <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
              </div>
            );
          })}
        </div>
      )
    }
  ];

  const handleSelectDesignAsLive = (id: number) => {
    setActiveDesignId(id);
    localStorage.setItem('erp_topbar_widget_style', String(id));
    window.dispatchEvent(new CustomEvent('topbar-widget-style-changed', { detail: { style: String(id) } }));
    toast.success(`تم بنجاح اعتماد النموذج (${id}) كشريط أدوات رئيسي للنظام!`, { icon: '✅' });
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col font-sans" dir="rtl">
      {/* Dashboard Top Header - RTL gradient banner */}
      <div className="bg-gradient-to-r from-violet-700 to-indigo-600 text-white p-8 shadow-md flex-none">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1.5 justify-start">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">معمل محاكاة واجهات المستخدم UI Lab</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight font-sans">تطبيق شريط الـ Widgets الحي بكافة النماذج</h1>
            <p className="text-sm text-indigo-100 mt-2 max-w-3xl leading-relaxed">
              قمنا بربط **عناصر الـ Widgets الحقيقية للنظام** (الساعة الجارية، تاريخ اليوم، السنة المالية الفعالة، والشركة النشطة وغيرها) مع تصاميم الـ 9 شريط أدوات المقترحة. تم تفعيل شاشة المحاكاة لتطابق قياس ومساحة الـ TopBar الأصلي، ويمكنك اعتماد أي تصميم للنظام فوراً بضغطة زر واحدة.
            </p>
          </div>

          <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shrink-0">
            <button
              onClick={() => setActiveView('widgets')}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                activeView === 'widgets' ? "bg-white text-indigo-700 shadow-lg" : "text-white hover:bg-white/10"
              )}
            >
              <LayoutGrid size={16} />
              معاينة 9 شريط أدوات حي
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                activeView === 'settings' ? "bg-white text-indigo-700 shadow-lg" : "text-white hover:bg-white/10"
              )}
            >
              <Settings size={16} />
              حفظ الإعدادات الموحد
            </button>
          </div>
        </div>
      </div>

      {/* Main Body content */}
      <div className={clsx(
        "flex-1 p-6 md:p-8 w-full transition-all",
        activeView === 'widgets' ? "max-w-none px-6 md:px-10" : "max-w-6xl mx-auto"
      )}>
        {activeView === 'widgets' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Context Notice / Instruction Zone */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-250 dark:border-amber-900/50 rounded-2xl p-5 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-4 shadow-xs">
              <AlertCircle className="w-5.5 h-5.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-right">
                <h3 className="font-black text-base">دعم سحب وتحريك العناصر الحية وإعادة ترتيبها:</h3>
                <p className="text-xs mt-1.5 leading-relaxed text-amber-800 dark:text-amber-300">
                  يمكنك الإمساك بأي شارة من الشارات الحية الموضحة بالأسفل (الشركة، التاريخ، الساعة، إلخ) وسحبها يساراً أو يميناً لإعادة ترتيبها. عند تعديل ترتيب العناصر، سيتم حفظ الترتيب فورياً وتحديثه عبر كافة النماذج الـ 9 المعروضة، وسيتم كذلك تطبيقه على الـ TopBar الحقيقي للنظام في رأس الصفحة!
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={resetWidgets}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-amber-300 text-amber-800 text-[11px] font-bold rounded-lg shadow-sm"
                  >
                    <RotateCcw size={12} />
                    إعادة ضبط الترتيب الافتراضي
                  </button>
                  <span className="text-[10px] text-amber-650 font-bold">تلميح: انقر على زر "اعتماد وتطبيق للنظام" لتشغيل النموذج المختار في شريط التنقل العلوي الفعلي للبرنامج.</span>
                </div>
              </div>
            </div>

            {/* List of 9 Stacked Mock Topbars */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <MousePointer className="text-indigo-600 w-5 h-5" />
                  النماذج المعاينة المتوفرة ({designs.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {designs.map((design) => {
                  const isLive = activeDesignId === design.id;
                  return (
                    <Card
                      key={design.id}
                      className={clsx(
                        "p-5 flex flex-col gap-4 border transition-all duration-300 text-right justify-start",
                        isLive
                          ? "border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/10 shadow-md ring-1 ring-indigo-500/30"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-350 shadow-sm"
                      )}
                    >
                      {/* Top bar info */}
                      <div className="flex items-start justify-between gap-4">
                        <button
                          onClick={() => handleSelectDesignAsLive(design.id)}
                          className={clsx(
                            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0",
                            isLive
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          )}
                        >
                          <CheckCircle2 size={14} className={clsx(isLive ? "text-white" : "text-slate-400")} />
                          {isLive ? "النموذج الفعال حالياً" : "اعتماد وتطبيق للنظام"}
                        </button>

                        <div className="flex-1 text-right">
                          <div className="flex items-center gap-2.5 justify-end">
                            <span className={clsx("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider", design.tagColor)}>
                              {design.tag}
                            </span>
                            <h3 className="font-extrabold text-sm text-slate-850 dark:text-slate-150">
                              {design.nameAr}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{design.nameEn}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-350 mt-2 max-w-4xl leading-relaxed">{design.descAr}</p>
                        </div>
                      </div>

                      {/* Mock Topbar Render Area */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[50px] shadow-inner select-none">
                        <div className="w-full max-w-4xl flex items-center justify-center">
                          {design.renderWidgets(widgets)}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Unified Settings Notice */}
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-5 text-sm text-indigo-900 dark:text-indigo-200 flex items-start gap-4 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-right">
                <h3 className="font-bold">لوحة إعدادات المظهر الموحدة</h3>
                <p className="text-xs mt-1 leading-relaxed text-indigo-800 dark:text-indigo-300">
                  توضح هذه اللوحة توافق الإعدادات وتأثيرها المباشر على كامل مظهر شريط الأدوات العلوي والألوان العامة للنظام.
                </p>
              </div>
            </div>

            {/* Embedded Mock settings */}
            <div className="border border-[var(--color-border)] rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xl min-h-[500px]">
              <MockUnifiedSettingsPage />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UiLabDashboard;
