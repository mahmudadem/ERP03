import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, LucideIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { clsx } from 'clsx';

export type DocumentPillTone = 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'red' | 'violet';

const pillToneClasses: Record<DocumentPillTone, string> = {
  slate: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  red: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
};

type ScaffoldRailState = {
  showInlineRail: boolean;
  railDrawerOpen: boolean;
};

export type DocumentScaffoldBodySlot =
  | 'control'
  | 'header'
  | 'lines'
  | 'secondary'
  | 'attachments'
  | 'custom';

export type DocumentScaffoldRailSlot =
  | 'info'
  | 'readiness'
  | 'settlement'
  | 'totals'
  | 'custom';

export type DocumentScaffoldFooterSlot = 'totals' | 'actions';

export type DocumentScaffoldSection = {
  show?: boolean;
  preserveSpace?: boolean;
  title?: string;
  action?: React.ReactNode;
  content?: React.ReactNode;
  className?: string;
};

export type DocumentScaffoldSections = Partial<Record<DocumentScaffoldBodySlot, DocumentScaffoldSection>>;
export type DocumentScaffoldRailSections = Partial<Record<DocumentScaffoldRailSlot, DocumentScaffoldSection>>;
export type DocumentScaffoldFooterSections = Partial<Record<DocumentScaffoldFooterSlot, DocumentScaffoldSection>>;

export const documentHeaderLabelClass = 'mb-1 block text-[10px] font-bold uppercase text-slate-500';
export const documentHeaderControlClass = 'h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500';
export const documentHeaderSelectorClass = 'h-9 [&>input]:h-9 [&>input]:rounded [&>input]:border-slate-300 [&>input]:py-0 [&>input]:text-xs dark:[&>input]:border-slate-700';

const isRenderable = (value: React.ReactNode): boolean =>
  value !== undefined && value !== null && value !== false;

const shouldRenderScaffoldSection = (section?: DocumentScaffoldSection): boolean =>
  !!section && section.show !== false && (section.preserveSpace || isRenderable(section.content));

const hasRenderableScaffoldSection = <TSlot extends string>(
  sections: Partial<Record<TSlot, DocumentScaffoldSection>> | undefined,
  slots: readonly TSlot[],
): boolean => slots.some((slot) => shouldRenderScaffoldSection(sections?.[slot]));

const renderScaffoldBodySection = (
  slot: DocumentScaffoldBodySlot,
  section?: DocumentScaffoldSection,
): React.ReactNode => {
  if (!shouldRenderScaffoldSection(section)) return null;

  return (
    <section
      key={slot}
      data-document-section={slot}
      className={clsx(
        slot === 'control' && 'shrink-0',
        slot === 'header' && 'shrink-0',
        slot === 'lines' && 'min-h-[210px] flex-none 2xl:flex-[1.2]',
        slot === 'secondary' && 'min-h-[150px] flex-none 2xl:flex-[0.55]',
        slot === 'attachments' && 'flex-none',
        slot === 'custom' && 'flex-none',
        section?.className,
      )}
    >
      {section?.title ? (
        <DocumentCompactCard title={section.title} action={section.action}>
          {section.content}
        </DocumentCompactCard>
      ) : (
        section?.content
      )}
    </section>
  );
};

const renderScaffoldRailSection = (
  slot: DocumentScaffoldRailSlot,
  section?: DocumentScaffoldSection,
): React.ReactNode => {
  if (!shouldRenderScaffoldSection(section)) return null;

  const content = section?.content ?? null;
  if (!section?.title) {
    return (
      <div key={slot} data-document-rail-section={slot} className={section?.className}>
        {content}
      </div>
    );
  }

  return (
    <DocumentRailCard
      key={slot}
      title={section.title}
      action={section.action}
      className={section.className}
    >
      {content}
    </DocumentRailCard>
  );
};

export function DocumentPill({
  tone = 'slate',
  children,
}: {
  tone?: DocumentPillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[9px] font-black uppercase tracking-wide',
        pillToneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DocumentField({
  label,
  value,
  muted,
  locked,
  plain,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  locked?: boolean;
  plain?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div
        className={clsx(
          'flex min-w-0 items-center rounded px-2 text-xs font-semibold',
          plain ? 'h-8' : 'h-9',
          plain
            ? 'border border-transparent bg-transparent px-0 text-slate-900 dark:text-slate-100'
            : locked
              ? 'border border-slate-200 bg-slate-100 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              : 'border border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
          muted && 'text-slate-500 dark:text-slate-400',
        )}
      >
        <span className="truncate">{value}</span>
      </div>
    </label>
  );
}

export function DocumentCompactCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        'flex shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3 dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="truncate text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DocumentHeaderGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DocumentHeaderField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('min-w-0', className)}>
      <label className={documentHeaderLabelClass}>{label}</label>
      {children}
    </div>
  );
}

export function DocumentControlPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        'shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DocumentSegmentedGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DocumentIconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
      title={title}
    >
      {children}
    </button>
  );
}

export function DocumentActionTray({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!isRenderable(children)) return null;
  return (
    <div
      data-document-action-tray
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950/70',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DocumentSegmentButton({
  active,
  disabled,
  icon: Icon,
  label,
  title,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={clsx(
        'inline-flex h-7 items-center gap-1.5 rounded px-2 text-[10px] font-black uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        active
          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-900'
          : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export function DocumentLinesRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex min-h-[210px] flex-none flex-col 2xl:flex-[1.2]', className)}>
      {children}
    </div>
  );
}

export function DocumentSecondaryPanel({
  title,
  accentClassName = 'bg-indigo-500',
  action,
  children,
  className,
}: {
  title: string;
  accentClassName?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex min-h-[150px] flex-none flex-col gap-1.5 2xl:flex-[0.55]', className)}>
      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex min-w-0 items-center gap-2">
            <span className={clsx('h-4 w-1 rounded-full', accentClassName)} />
            <span className="truncate text-[11px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
              {title}
            </span>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

export function DocumentEmptyPanel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[110px] items-center justify-center bg-slate-50/70 px-4 py-5 text-center dark:bg-slate-900/40">
      <div className="max-w-xl">
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
          {title}
        </div>
        {description && (
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function DocumentRailCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        'min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="flex h-8 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3 dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="truncate text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DocumentRailStat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'slate' | 'green' | 'blue' | 'amber' | 'rose';
}) {
  const valueClass = {
    slate: 'text-slate-900 dark:text-slate-100',
    green: 'text-emerald-700 dark:text-emerald-300',
    blue: 'text-blue-700 dark:text-blue-300',
    amber: 'text-amber-700 dark:text-amber-300',
    rose: 'text-rose-700 dark:text-rose-300',
  }[tone];

  return (
    <div className="rounded border border-slate-100 bg-slate-50/70 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className={clsx('truncate font-mono text-xs font-black', valueClass)}>{value}</div>
    </div>
  );
}

export function DocumentFooterTotalsStrip({
  totals,
}: {
  totals: Array<{ label: string; value: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'rose' }>;
}) {
  const toneClasses = {
    slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {totals.map((total) => (
        <div
          key={total.label}
          className={clsx(
            'rounded-md px-2 py-1 font-mono font-black',
            toneClasses[total.tone || 'slate'],
          )}
        >
          <span className="mr-1 font-sans text-[9px] uppercase tracking-wide opacity-70">{total.label}</span>
          {total.value}
        </div>
      ))}
    </div>
  );
}

export function DocumentDetailScaffold({
  title,
  subtitle,
  icon: Icon,
  backLabel,
  onBack,
  badges,
  headerTools,
  banner,
  children,
  sections,
  sideRail,
  railSections,
  railTitle,
  forceRailDrawer = false,
  defaultRailPinned = true,
  showRailEdgeButton = true,
  footerSummary,
  footerActions,
  footerSections,
  isWindow,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  backLabel: string;
  onBack: () => void;
  badges?: React.ReactNode;
  headerTools?: React.ReactNode;
  banner?: React.ReactNode;
  children?: React.ReactNode;
  sections?: DocumentScaffoldSections;
  sideRail?: React.ReactNode;
  railSections?: DocumentScaffoldRailSections;
  railTitle?: string;
  forceRailDrawer?: boolean;
  defaultRailPinned?: boolean;
  showRailEdgeButton?: boolean;
  footerSummary?: React.ReactNode | ((state: ScaffoldRailState) => React.ReactNode);
  footerActions?: React.ReactNode | ((state: ScaffoldRailState) => React.ReactNode);
  footerSections?: DocumentScaffoldFooterSections;
  isWindow?: boolean;
}) {
  const { t, i18n } = useTranslation('common');
  const [railPinned, setRailPinned] = useState(defaultRailPinned);
  const [railDrawerOpen, setRailDrawerOpen] = useState(false);
  const [railAutoCollapsed, setRailAutoCollapsed] = useState(false);
  const isRtl = i18n.dir() === 'rtl';
  const railLabel = railTitle ?? t('documentDetail.sideRail', 'Document side rail');
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const RailOpenIcon = isRtl ? PanelLeftOpen : PanelRightOpen;
  const RailCloseIcon = isRtl ? PanelLeftClose : PanelRightClose;
  const bodySlots = ['control', 'header', 'lines', 'secondary', 'attachments', 'custom'] as const;
  const railSlots = ['info', 'readiness', 'settlement', 'totals', 'custom'] as const;
  const bodySections = sections ?? {
    control: { show: false },
    header: { show: false },
    lines: { show: false },
    secondary: { show: false },
    attachments: { show: false },
    custom: { show: isRenderable(children), content: children },
  };
  const scaffoldBody = bodySlots.map((slot) => renderScaffoldBodySection(slot, bodySections[slot]));
  const normalizedRailSections = railSections ?? {
    info: { show: false },
    readiness: { show: false },
    settlement: { show: false },
    totals: { show: false },
    custom: { show: isRenderable(sideRail), content: sideRail },
  };
  const scaffoldRail = railSlots.map((slot) => renderScaffoldRailSection(slot, normalizedRailSections[slot]));
  const hasRail = hasRenderableScaffoldSection(normalizedRailSections, railSlots);

  useEffect(() => {
    if (!hasRail || typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1279px)');
    const syncRailMode = () => {
      setRailAutoCollapsed(media.matches);
      if (media.matches || forceRailDrawer) {
        setRailDrawerOpen(false);
      }
    };

    syncRailMode();
    media.addEventListener('change', syncRailMode);
    return () => media.removeEventListener('change', syncRailMode);
  }, [forceRailDrawer, hasRail]);

  const railUsesDrawer = hasRail && (forceRailDrawer || railAutoCollapsed);
  const showInlineRail = hasRail && !railUsesDrawer && railPinned;
  const railState = { showInlineRail, railDrawerOpen };
  const footerTotalsSection = footerSections?.totals;
  const footerActionsSection = footerSections?.actions;
  const renderedFooterSummary =
    footerSections
      ? shouldRenderScaffoldSection(footerTotalsSection)
        ? footerTotalsSection?.content
        : null
      : typeof footerSummary === 'function'
        ? footerSummary(railState)
        : footerSummary;
  const renderedFooterActions =
    footerSections
      ? shouldRenderScaffoldSection(footerActionsSection)
        ? footerActionsSection?.content
        : null
      : typeof footerActions === 'function'
        ? footerActions(railState)
        : footerActions;

  useEffect(() => {
    if (!railUsesDrawer) {
      setRailDrawerOpen(false);
    }
  }, [railUsesDrawer]);

  const showRailFromEdge = () => {
    if (railUsesDrawer) {
      setRailDrawerOpen(true);
    } else {
      setRailPinned(true);
    }
  };

  const renderRailEdgeButton = () => {
    if (!hasRail || !showRailEdgeButton || showInlineRail) return null;
    return (
      <button
        type="button"
        onClick={showRailFromEdge}
        title={railLabel}
        className={clsx(
          'absolute top-1/2 z-30 flex h-24 w-6 -translate-y-1/2 items-center justify-center border border-slate-200 bg-white text-slate-600 shadow-md transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
          isRtl
            ? 'left-0 rounded-r-md border-l-0'
            : 'right-0 rounded-l-md border-r-0',
        )}
      >
        <RailOpenIcon className="h-4 w-4" />
        <span className="sr-only">{railLabel}</span>
      </button>
    );
  };

  const renderRailDrawer = () => {
    if (!hasRail || !railDrawerOpen) return null;
    return (
      <div
        className={clsx(
          'absolute inset-0 z-40 flex bg-slate-950/20 backdrop-blur-[1px]',
          isRtl ? 'justify-start' : 'justify-end',
        )}
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label={railLabel}
          onClick={() => setRailDrawerOpen(false)}
        />
        <aside
          className={clsx(
            'relative z-10 flex h-full w-[min(360px,92vw)] flex-col bg-slate-50 shadow-2xl dark:bg-slate-950',
            isRtl
              ? 'border-r border-slate-200 dark:border-slate-800'
              : 'border-l border-slate-200 dark:border-slate-800',
          )}
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 items-center gap-2">
              <RailOpenIcon className="h-4 w-4 text-slate-500" />
              <span className="truncate text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {railLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRailDrawerOpen(false)}
              title={railLabel}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto p-2">
            {scaffoldRail}
          </div>
        </aside>
      </div>
    );
  };

  return (
    <div
      className={clsx(
        'relative flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950',
        isWindow && 'w-full',
      )}
    >
      <div className="flex-none flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={onBack}
            title={backLabel}
          >
            <BackIcon className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="h-4.5 w-4.5 shrink-0 text-blue-600" />
              <h1 className="truncate text-sm font-black tracking-wide text-slate-950 dark:text-slate-100">
                {title}
              </h1>
              {badges}
            </div>
            {subtitle && <div className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</div>}
          </div>
        </div>
        {isRenderable(headerTools) && <DocumentActionTray>{headerTools}</DocumentActionTray>}
      </div>

      {banner && <div className="mx-3 mt-2 shrink-0">{banner}</div>}

      <div
        className={clsx(
          'grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto overflow-x-hidden p-2',
          showInlineRail && 'xl:grid-cols-[minmax(0,1fr)_304px] 2xl:overflow-hidden',
        )}
      >
        <section className={clsx('flex min-h-0 flex-col gap-2', isRtl ? 'pl-1' : 'pr-1', !isWindow && '2xl:overflow-y-auto')}>
          {scaffoldBody}
        </section>
        {showInlineRail && (
          <aside className="relative grid min-h-0 auto-rows-min gap-2 2xl:grid-rows-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] 2xl:overflow-hidden">
            <button
              type="button"
              onClick={() => setRailPinned(false)}
              title={railLabel}
              className={clsx(
                'absolute top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                isRtl ? '-right-3' : '-left-3',
              )}
            >
              <RailCloseIcon className="h-4 w-4" />
              <span className="sr-only">{railLabel}</span>
            </button>
            {scaffoldRail}
          </aside>
        )}
      </div>

      {renderRailEdgeButton()}
      {renderRailDrawer()}

      <footer
        className={clsx(
          'z-20 shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95',
          !isWindow && '2xl:sticky 2xl:bottom-0',
        )}
      >
        <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">{renderedFooterSummary}</div>
          <div className="flex flex-wrap items-center justify-end gap-2">{renderedFooterActions}</div>
        </div>
      </footer>
    </div>
  );
}
