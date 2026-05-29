import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useWidgetStore } from '../../store/widgetStore';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { Clock, Calendar, ShieldCheck, Monitor, HelpCircle, Landmark, Coins, ChevronDown, ChevronUp, Bell, FileText } from 'lucide-react';
import { ClockWidget } from './widgets/ClockWidget';
import { DateWidget } from './widgets/DateWidget';
import { FiscalYearWidget } from './widgets/FiscalYearWidget';
import { BaseCurrencyWidget } from './widgets/BaseCurrencyWidget';
import { ApprovalModeWidget } from './widgets/ApprovalModeWidget';
import { UIModeWidget } from './widgets/UIModeWidget';
import { NotesWidget } from './widgets/NotesWidget';
import { AlarmWidget } from './widgets/AlarmWidget';
import { CompanyLogoNameWidget } from './widgets/CompanyLogoNameWidget';

interface MockWidgetTrayProps {
  isAlwaysExpanded?: boolean;
}

export const MockWidgetTray: React.FC<MockWidgetTrayProps> = ({ isAlwaysExpanded = false }) => {
  const { t } = useTranslation('common');
  const { widgets, toggleWidget } = useWidgetStore();
  const { theme } = useUserPreferences();
  const [isExpanded, setIsExpanded] = useState(true);

  // Icon mapping for custom premium UI
  const widgetIcons: Record<string, React.ReactNode> = {
    'company-logo': <Landmark className="w-4 h-4 text-blue-500" />,
    'fiscal-year': <Calendar className="w-4 h-4 text-emerald-500" />,
    'base-currency': <Coins className="w-4 h-4 text-amber-500" />,
    'approval-mode': <ShieldCheck className="w-4 h-4 text-purple-500" />,
    'ui-mode': <Monitor className="w-4 h-4 text-sky-500" />,
    'clock': <Clock className="w-4 h-4 text-rose-500" />,
    'date': <Calendar className="w-4 h-4 text-indigo-500" />,
    'notes': <FileText className="w-4 h-4 text-teal-500" />,
    'alarm': <Bell className="w-4 h-4 text-orange-500" />,
  };

  const visibleWidgets = widgets.filter(w => w.visible);

  return (
    <div className="w-full flex flex-col transition-all duration-300">
      {/* Expand/Collapse Handle */}
      {!isAlwaysExpanded && (
        <div className="flex justify-center -mt-1 mb-1 relative z-10">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-3 py-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] shadow-sm text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] transition-all active:scale-95"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 text-indigo-500" />
                {t('widgets.hideWidgets', 'Hide Dashboard Widgets')}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 text-indigo-500" />
                {t('widgets.showWidgets', 'Show Dashboard Widgets')}
              </>
            )}
          </button>
        </div>
      )}

      {/* The Tray Container */}
      <div
        className={clsx(
          "w-full overflow-hidden transition-all duration-300",
          isExpanded ? "max-h-32 opacity-100 py-2.5 px-4" : "max-h-0 opacity-0 py-0 px-0"
        )}
      >
        <div className="w-full rounded-2xl glass border border-white/30 dark:border-slate-800/50 shadow-soft-lg p-3 bg-gradient-to-r from-white/40 via-white/70 to-white/40 dark:from-slate-900/40 dark:via-slate-900/60 dark:to-slate-900/40 flex items-center justify-start gap-4 overflow-x-auto custom-scroll">
          {visibleWidgets.map((widget) => {
            // Render specific components with premium glass shell
            return (
              <div
                key={widget.id}
                className="group flex-shrink-0 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded-xl bg-white/80 dark:bg-slate-950/80 border border-slate-200/50 dark:border-slate-800/40 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 shadow-inner">
                  {widgetIcons[widget.type] || <HelpCircle className="w-4 h-4 text-gray-500" />}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                    {t(`widgets.types.${widget.type}`, { defaultValue: widget.type })}
                  </span>
                  <div className="text-xs font-black tracking-tight text-[var(--color-text-primary)] leading-none truncate">
                    {widget.type === 'clock' && (
                      <ClockWidget showBorder={false} showBackground={false} showSeconds={false} />
                    )}
                    {widget.type === 'date' && (
                      <DateWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'fiscal-year' && (
                      <FiscalYearWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'base-currency' && (
                      <BaseCurrencyWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'approval-mode' && (
                      <ApprovalModeWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'ui-mode' && (
                      <UIModeWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'notes' && (
                      <NotesWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'alarm' && (
                      <AlarmWidget showBorder={false} showBackground={false} />
                    )}
                    {widget.type === 'company-logo' && (
                      <CompanyLogoNameWidget showBorder={false} showBackground={false} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleWidgets.length === 0 && (
            <div className="w-full flex items-center justify-center py-2 text-xs text-gray-400 italic">
              {t('widgets.noVisibleWidgets', 'No widgets are visible on the dashboard.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
