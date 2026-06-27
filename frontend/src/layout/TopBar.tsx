import React, { Fragment, useMemo } from "react";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import {
  Menu,
  Moon,
  Sun,
  LogOut,
  User,
  Building2,
  LayoutTemplate,
  ListChecks,
  Palette,
  RefreshCcw,
  Landmark,
  Calendar,
  Clock,
  Coins,
  ShieldCheck,
  Monitor,
  FileText,
  Bell,
  HelpCircle,
  Search,
} from "lucide-react";
import { Menu as HeadlessMenu, Transition } from "@headlessui/react";
import { NotificationBell } from "../components/NotificationBell";
import { useTranslation } from "react-i18next";
import { DraggableWidgetSpace } from "../components/topbar/DraggableWidgetSpace";
import { useWidgetStore } from "../store/widgetStore";
import toast from "react-hot-toast";

// Real widget components
import { ClockWidget } from "../components/topbar/widgets/ClockWidget";
import { DateWidget } from "../components/topbar/widgets/DateWidget";
import { FiscalYearWidget } from "../components/topbar/widgets/FiscalYearWidget";
import { BaseCurrencyWidget } from "../components/topbar/widgets/BaseCurrencyWidget";
import { ApprovalModeWidget } from "../components/topbar/widgets/ApprovalModeWidget";
import { UIModeWidget } from "../components/topbar/widgets/UIModeWidget";
import { NotesWidget } from "../components/topbar/widgets/NotesWidget";
import { AlarmWidget } from "../components/topbar/widgets/AlarmWidget";
import { CompanyLogoNameWidget } from "../components/topbar/widgets/CompanyLogoNameWidget";
import { SearchWidget } from "../components/topbar/widgets/SearchWidget";

interface TopBarProps {
  onMenuClick?: () => void;
}

const WIDGET_ICONS: Record<string, React.ComponentType<any>> = {
  "company-logo": Landmark,
  "fiscal-year": Calendar,
  "base-currency": Coins,
  "approval-mode": ShieldCheck,
  "ui-mode": Monitor,
  clock: Clock,
  date: Calendar,
  notes: FileText,
  alarm: Bell,
  search: Search,
};

const WIDGET_COLORS: Record<string, string> = {
  "company-logo": "text-blue-500",
  "fiscal-year": "text-emerald-500",
  "base-currency": "text-amber-500",
  "approval-mode": "text-purple-500",
  "ui-mode": "text-sky-500",
  clock: "text-rose-500",
  date: "text-indigo-500",
  notes: "text-teal-500",
  alarm: "text-orange-500",
  search: "text-slate-400",
};

function renderRealWidget(type: string) {
  switch (type) {
    case "clock":      return <ClockWidget showBorder={false} showBackground={false} showSeconds={false} compact={true} />;
    case "date":       return <DateWidget showBorder={false} showBackground={false} compact={true} />;
    case "fiscal-year": return <FiscalYearWidget showBorder={false} showBackground={false} compact={true} />;
    case "base-currency": return <BaseCurrencyWidget showBorder={false} showBackground={false} compact={true} />;
    case "approval-mode": return <ApprovalModeWidget showBorder={false} showBackground={false} compact={true} />;
    case "ui-mode":    return <UIModeWidget showBorder={false} showBackground={false} compact={true} />;
    case "notes":      return <NotesWidget showBorder={false} showBackground={false} compact={true} />;
    case "alarm":      return <AlarmWidget showBorder={false} showBackground={false} compact={true} />;
    case "company-logo": return <CompanyLogoNameWidget showBorder={false} showBackground={false} compact={true} />;
    case "search":     return <SearchWidget showBorder={false} showBackground={false} compact={true} />;
    default:           return null;
  }
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { uiMode, setUiMode, theme, toggleTheme, appearanceSettings, layoutMode } = useUserPreferences();
  const isCompact = layoutMode === "compact";
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const isRtl = useMemo(() => i18n.dir() === "rtl", [i18n]);
  const { widgets, toggleWidget, isLayoutMode, setLayoutMode, updateWidgetLayouts } = useWidgetStore();
  const isMdUp = useBreakpoint("md");
  const { showWidgetsOnMobile, showTopbarActionsOnMobile } = useUserPreferences();

  // Widget bar visual style (1,2,3,5,10,11,16,17,18)
  const [widgetStyle, setWidgetStyle] = React.useState<string>(() =>
    localStorage.getItem("erp_topbar_widget_style") || (layoutMode === "compact" ? "5" : "1")
  );

  React.useEffect(() => {
    if (layoutMode === "compact" && !localStorage.getItem("erp_topbar_widget_style")) {
      setWidgetStyle("5");
    } else if (layoutMode === "legacy" && !localStorage.getItem("erp_topbar_widget_style")) {
      setWidgetStyle("1");
    }
  }, [layoutMode]);

  // Listen for style changes from AppearanceSettingsPage or UiLabDashboard
  React.useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.style) setWidgetStyle(e.detail.style);
    };
    window.addEventListener("topbar-widget-style-changed", handler);
    return () => window.removeEventListener("topbar-widget-style-changed", handler);
  }, []);

  const widgetTypeLabel = (type: string) => {
    if (type === "search") return isRtl ? "البحث" : "Search";
    return t(`widgets.types.${type}`, { defaultValue: type });
  };

  const userInitial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "U";

  // Visible widgets sorted by x position
  const sortedVisible = React.useMemo(
    () => [...widgets].filter((w) => w.visible).sort((a, b) => a.layout.x - b.layout.x),
    [widgets]
  );

  // Drag-to-reorder state for inline styles
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const reordered = [...sortedVisible];
    const [removed] = reordered.splice(draggedIdx, 1);
    reordered.splice(idx, 0, removed);
    updateWidgetLayouts(reordered.map((w, i) => ({ i: w.id, x: i * 10, y: 0, w: w.layout.w, h: 1 })));
    setDraggedIdx(idx);
  };
  const handleDragEnd = () => setDraggedIdx(null);

  const autoAlignWidgets = () => {
    const active = widgets.filter((w) => w.visible);
    if (active.length === 0) return;
    const base = Math.floor(96 / active.length);
    const extra = 96 % active.length;
    let nextX = 0;
    updateWidgetLayouts(
      active.map((w, i) => {
        const width = base + (i < extra ? 1 : 0);
        const layout = { i: w.id, x: nextX, y: 0, w: width, h: 1 };
        nextX += width;
        return layout;
      })
    );
  };

  // Render inline styled widget bar (9 styles)
  const renderStyledWidgets = (styleId: string) => {
    const list = sortedVisible;
    if (list.length === 0) return null;

    switch (styleId) {
      // 1 — Double-Decker Micro Cards
      case "1":
        return (
          <div className="flex gap-2 select-none">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200/40 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-950/40 cursor-grab select-none min-w-[60px]"
                >
                  <Icon className={clsx("w-2.5 h-2.5 shrink-0", WIDGET_COLORS[w.type])} />
                  <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-tight truncate shrink-0">
                    {renderRealWidget(w.type)}
                  </div>
                </div>
              );
            })}
          </div>
        );

      // 2 — Tech Terminal Brackets
      case "2":
        return (
          <div className="flex gap-2 items-center font-mono text-[11px] select-none text-slate-500 dark:text-slate-400">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1 cursor-grab active:cursor-grabbing select-none"
                >
                  <span className="text-indigo-500/85 font-black">[</span>
                  <Icon className={clsx("w-3 h-3 shrink-0", WIDGET_COLORS[w.type])} />
                  <div className="leading-none shrink-0 text-slate-700 dark:text-slate-200">{renderRealWidget(w.type)}</div>
                  <span className="text-indigo-500/85 font-black">]</span>
                </div>
              );
            })}
          </div>
        );

      // 3 — Pipeline Separators
      case "3":
        return (
          <div className="flex items-center gap-1 select-none">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <Fragment key={w.id}>
                  {idx > 0 && <span className="text-slate-300 dark:text-slate-700 font-light px-1.5 text-sm select-none">|</span>}
                  <div draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-grab active:cursor-grabbing hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <Icon className={clsx("w-3.5 h-3.5 shrink-0", WIDGET_COLORS[w.type])} />
                    <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        );

      // 5 — Bubble Pill
      case "5":
        return (
          <div className="flex gap-2 select-none">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm text-xs font-bold transition-all cursor-grab",
                    w.type === "company-logo"  && "bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900",
                    w.type === "fiscal-year"   && "bg-emerald-50/50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900",
                    w.type === "base-currency" && "bg-amber-50/50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900",
                    w.type === "approval-mode" && "bg-purple-50/50 border-purple-200 text-purple-700 dark:bg-purple-950/20 dark:border-purple-900",
                    w.type === "ui-mode"       && "bg-sky-50/50 border-sky-200 text-sky-700 dark:bg-sky-950/20 dark:border-sky-900",
                    w.type === "clock"         && "bg-rose-50/50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900",
                    w.type === "date"          && "bg-indigo-50/50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900",
                    w.type === "notes"         && "bg-teal-50/50 border-teal-200 text-teal-700 dark:bg-teal-950/20 dark:border-teal-900",
                    w.type === "alarm"         && "bg-orange-50/50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-900",
                    w.type === "search"        && "bg-slate-50/50 border-slate-200 text-slate-600 dark:bg-slate-950/20 dark:border-slate-800",
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                </div>
              );
            })}
          </div>
        );

      // 10 — Slanted Angles
      case "10":
        return (
          <div className="flex gap-1.5 select-none overflow-hidden py-1">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 transform -skew-x-12 cursor-grab hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="transform skew-x-12 flex items-center gap-1.5">
                    <Icon className={clsx("w-3 h-3 shrink-0", WIDGET_COLORS[w.type])} />
                    <div className="leading-none shrink-0 text-[10px] font-bold text-slate-700 dark:text-slate-200">{renderRealWidget(w.type)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );

      // 11 — Dotted Matrix
      case "11":
        return (
          <div className="flex gap-2 select-none">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-indigo-500/50 bg-slate-50/50 dark:bg-slate-900/30 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 cursor-grab hover:border-indigo-500"
                >
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0", WIDGET_COLORS[w.type])} />
                  <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                </div>
              );
            })}
          </div>
        );

      // 16 — Coupon Tag
      case "16":
        return (
          <div className="flex gap-2 select-none py-1">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 relative rounded cursor-grab shadow-sm font-bold text-xs text-slate-700 dark:text-slate-200"
                >
                  <div className="absolute top-1/2 -left-1 w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-950 border-r border-slate-300 dark:border-slate-700 -translate-y-1/2" />
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0", WIDGET_COLORS[w.type])} />
                  <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                  <div className="absolute top-1/2 -right-1 w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-950 border-l border-slate-300 dark:border-slate-700 -translate-y-1/2" />
                </div>
              );
            })}
          </div>
        );

      // 17 — Dashed Blueprint
      case "17":
        return (
          <div className="flex gap-2 select-none font-mono py-1">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-sky-400/60 bg-sky-50/10 text-sky-400 cursor-grab text-[10px]"
                >
                  <Icon className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                  <div className="font-bold leading-none shrink-0">{renderRealWidget(w.type)}</div>
                </div>
              );
            })}
          </div>
        );

      // 18 — State Dot Indicator
      case "18":
        return (
          <div className="flex gap-3 select-none">
            {list.map((w, idx) => {
              const Icon = WIDGET_ICONS[w.type] || HelpCircle;
              return (
                <div key={w.id} draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-grab text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <span className={clsx("w-2 h-2 rounded-full shrink-0 animate-pulse", w.type === "clock" || w.type === "alarm" ? "bg-red-500" : "bg-emerald-500")} />
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0", WIDGET_COLORS[w.type])} />
                  <div className="leading-none shrink-0">{renderRealWidget(w.type)}</div>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  const isTailwindPlayTheme = appearanceSettings?.id === "tailwind-play";

  return (
    // NOTE: NO overflow-hidden here — dropdowns must be able to render outside the bar
    <header
      className={clsx(
        "h-12 flex items-center justify-between px-3 sticky top-0 z-40 shrink-0 print:hidden",
        isCompact
          ? "bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]"
          : isTailwindPlayTheme
            ? "bg-[var(--app-topbar-surface)] backdrop-blur-md border-b-0"
            : "bg-[var(--app-topbar-surface)] backdrop-blur-md border-b border-[var(--color-border)] shadow-sm",
      )}
    >
      {/* Hamburger menu toggle button */}
      <button
        onClick={onMenuClick}
        className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded shrink-0"
        title="Toggle Sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Widget space */}
      {(isMdUp || showWidgetsOnMobile) ? (
        isLayoutMode ? (
          // Full 96-column canvas editor when in layout mode
          <DraggableWidgetSpace />
        ) : (
          // Styled inline bar in normal mode
          <div className="flex-1 flex justify-center items-center overflow-x-auto px-4 max-w-[calc(100vw-360px)]">
            {renderStyledWidgets(widgetStyle)}
          </div>
        )
      ) : (
        <div className="flex-1" />
      )}

      {/* Right-side controls — always visible, never clipped */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {/* Actions group — hidden on mobile unless preference set */}
        <div
          className={clsx(
            "items-center gap-1",
            isMdUp ? "flex" : showTopbarActionsOnMobile ? "flex" : "hidden",
          )}
        >
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] p-2 rounded-lg"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>

          {/* Widget / Layout Actions */}
          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button
              className={clsx(
                "p-2 rounded-lg transition-all",
                isLayoutMode
                  ? "bg-indigo-600 text-white shadow-lg scale-110"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <ListChecks className="w-4 h-4" />
            </HeadlessMenu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <HeadlessMenu.Items
                className={clsx(
                  "absolute z-[200] mt-2 w-64 rounded-xl bg-[var(--color-bg-primary)] shadow-lg shadow-slate-900/10 border border-[var(--color-border)] focus:outline-none p-2",
                  isRtl ? "left-0 origin-top-left" : "right-0 origin-top-right",
                )}
              >
                {/* Layout edit mode toggle */}
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={(e) => { e.preventDefault(); setLayoutMode(!isLayoutMode); }}
                      className={clsx(
                        "flex items-center justify-between w-full px-2 py-2 text-xs rounded-lg transition-colors font-bold tracking-tight",
                        active
                          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                          : isLayoutMode
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                            : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <LayoutTemplate className="w-3.5 h-3.5 text-slate-400" />
                        {isLayoutMode
                          ? t("widgets.doneEditing", "Done Editing")
                          : t("widgets.editLayout", "Edit & Layout")}
                      </span>
                      <div
                        className={clsx(
                          "w-2.5 h-2.5 rounded-full border shadow-inner",
                          isLayoutMode
                            ? "bg-indigo-500 border-indigo-600"
                            : "bg-slate-100 border-slate-300",
                        )}
                      />
                    </button>
                  )}
                </HeadlessMenu.Item>

                {/* Auto align */}
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={(e) => { e.preventDefault(); autoAlignWidgets(); }}
                      className={clsx(
                        "flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors font-bold tracking-tight",
                        active
                          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      <RefreshCcw className="w-3.5 h-3.5 text-slate-400" />
                      {t("widgets.autoAlign", "Auto Align")}
                    </button>
                  )}
                </HeadlessMenu.Item>

                {/* Widget designer */}
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={(e) => { e.preventDefault(); navigate("/settings/widgets"); }}
                      className={clsx(
                        "flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors font-bold tracking-tight",
                        active
                          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      <Palette className="w-3.5 h-3.5 text-slate-400" />
                      {t("widgets.designer.subtitle", "Widget Designer")}
                    </button>
                  )}
                </HeadlessMenu.Item>

                <div className="my-1.5 border-t border-[var(--color-border)]" />

                {/* Widget style selector */}
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5">
                  {t("widgets.layoutStyle", "Bar Style")}
                </div>
                <div className="px-2 pb-2">
                  <select
                    value={widgetStyle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWidgetStyle(val);
                      localStorage.setItem("erp_topbar_widget_style", val);
                      window.dispatchEvent(new CustomEvent("topbar-widget-style-changed", { detail: { style: val } }));
                      toast.success(t("widgets.styleUpdated", "Widget bar style updated!"));
                    }}
                    className="w-full text-xs font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-1.5 focus:outline-none text-[var(--color-text-primary)]"
                  >
                    <option value="1">1: العرض المزدوج الرأسي المتكدس</option>
                    <option value="2">2: النظام الهندسي البرمجي</option>
                    <option value="3">{t(`3: خطوط الفاصل العمودي (Pipeline)`)}</option>
                    <option value="5">5: الكبسولة الفقاعية الموحدة</option>
                    <option value="10">10: الأشكال الهندسية المائلة</option>
                    <option value="11">11: الإطارات المنقطة التقنية</option>
                    <option value="16">16: بطاقة الكوبون المثقوبة</option>
                    <option value="17">17: المخطط الهندسي المتقطع</option>
                    <option value="18">18: مؤشرات النقاط الملونة</option>
                  </select>
                </div>

                <div className="my-1.5 border-t border-[var(--color-border)]" />

                {/* Show / hide widgets */}
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">
                  {t("widgets.addWidget", "Show / Hide Widgets")}
                </div>

                {widgets.map((w) => (
                  <HeadlessMenu.Item key={w.id}>
                    {({ active }) => (
                      <button
                        onClick={(e) => { e.preventDefault(); toggleWidget(w.id); }}
                        className={clsx(
                          "flex items-center justify-between w-full px-2 py-2 text-xs rounded-lg transition-colors font-bold tracking-tight uppercase",
                          active
                            ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                            : "text-[var(--color-text-secondary)]",
                        )}
                      >
                        <span>{widgetTypeLabel(w.type)}</span>
                        <div
                          className={clsx(
                            "w-2.5 h-2.5 rounded-full border shadow-inner",
                            w.visible
                              ? "bg-emerald-500 border-emerald-600"
                              : "bg-slate-100 border-slate-300",
                          )}
                        />
                      </button>
                    )}
                  </HeadlessMenu.Item>
                ))}
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>

          {/* Notification Bell */}
          <NotificationBell />
        </div>

        {/* User Avatar Menu — always visible */}
        <HeadlessMenu as="div" className="relative ml-1">
          <HeadlessMenu.Button className="flex items-center rounded-full bg-[var(--color-bg-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 hover:ring-2 hover:ring-indigo-100 transition-all p-0.5 border border-transparent hover:border-indigo-100">
            <span className="sr-only">{t(`Open user menu`)}</span>
            <div className="h-8 w-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm ring-1 ring-white">
              {userInitial}
            </div>
          </HeadlessMenu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <HeadlessMenu.Items
              className={clsx(
                "absolute z-[200] mt-3 w-56 rounded-xl bg-[var(--color-bg-primary)] shadow-lg shadow-slate-900/10 ring-1 ring-black/5 focus:outline-none overflow-hidden",
                isRtl ? "left-0 origin-top-left" : "right-0 origin-top-right",
              )}
            >
              <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                  {user?.displayName || "User"}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              <div className="p-1">
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => navigate("/profile")}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors mt-1",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <User className="w-4 h-4" />
                      Your Profile
                    </button>
                  )}
                </HeadlessMenu.Item>

                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => navigate("/settings/appearance")}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <Palette className="w-4 h-4" />
                      Appearance
                    </button>
                  )}
                </HeadlessMenu.Item>

                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => { setUiMode("classic"); navigate("/company-selector"); }}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors mb-1 border-b border-[var(--color-border)] pb-3 rounded-b-none",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <Building2 className="w-4 h-4" />
                      Switch Company
                    </button>
                  )}
                </HeadlessMenu.Item>

                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={logout}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors mt-1",
                        active
                          ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "text-red-600 dark:text-red-500 hover:bg-red-50 hover:text-red-700",
                      )}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  )}
                </HeadlessMenu.Item>
              </div>
            </HeadlessMenu.Items>
          </Transition>
        </HeadlessMenu>
      </div>
    </header>
  );
};
