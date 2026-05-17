import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  RefreshCcw,
  RotateCcw,
  Square,
} from "lucide-react";
import { DraggableWidgetSpace } from "../../../components/topbar/DraggableWidgetSpace";
import { ClockWidget } from "../../../components/topbar/widgets/ClockWidget";
import { DateWidget } from "../../../components/topbar/widgets/DateWidget";
import { NotesWidget } from "../../../components/topbar/widgets/NotesWidget";
import { AlarmWidget } from "../../../components/topbar/widgets/AlarmWidget";
import { CompanyLogoNameWidget } from "../../../components/topbar/widgets/CompanyLogoNameWidget";
import { FiscalYearWidget } from "../../../components/topbar/widgets/FiscalYearWidget";
import { BaseCurrencyWidget } from "../../../components/topbar/widgets/BaseCurrencyWidget";
import { ApprovalModeWidget } from "../../../components/topbar/widgets/ApprovalModeWidget";
import { UIModeWidget } from "../../../components/topbar/widgets/UIModeWidget";
import { useWidgetStore, WidgetConfig, WidgetStyle, WidgetType } from "../../../store/widgetStore";

const WIDGET_COMPONENT_MAP: Record<string, React.FC<any>> = {
  clock: ClockWidget,
  date: DateWidget,
  notes: NotesWidget,
  alarm: AlarmWidget,
  "company-logo": CompanyLogoNameWidget,
  "fiscal-year": FiscalYearWidget,
  "base-currency": BaseCurrencyWidget,
  "approval-mode": ApprovalModeWidget,
  "ui-mode": UIModeWidget,
};

const WIDGET_TYPES: { type: WidgetType; icon: string }[] = [
  { type: "clock", icon: "🕐" },
  { type: "date", icon: "📅" },
  { type: "notes", icon: "📝" },
  { type: "alarm", icon: "🔔" },
  { type: "company-logo", icon: "🏢" },
  { type: "fiscal-year", icon: "📊" },
  { type: "base-currency", icon: "💰" },
  { type: "approval-mode", icon: "🛡️" },
  { type: "ui-mode", icon: "🖥️" },
];

const BG_OPTIONS = [
  { label: "None", className: "bg-transparent", swatch: "bg-white" },
  { label: "White", className: "bg-white", swatch: "bg-white" },
  { label: "Zinc", className: "bg-zinc-50", swatch: "bg-zinc-50" },
  { label: "Slate", className: "bg-slate-50", swatch: "bg-slate-50" },
  { label: "Red", className: "bg-red-50", swatch: "bg-red-50" },
  { label: "Orange", className: "bg-orange-50", swatch: "bg-orange-50" },
  { label: "Sky", className: "bg-sky-50", swatch: "bg-sky-50" },
  { label: "Cyan", className: "bg-cyan-50", swatch: "bg-cyan-50" },
  { label: "Emerald", className: "bg-emerald-50", swatch: "bg-emerald-50" },
  { label: "Yellow", className: "bg-yellow-50", swatch: "bg-yellow-50" },
  { label: "Amber", className: "bg-amber-50", swatch: "bg-amber-50" },
  { label: "Rose", className: "bg-rose-50", swatch: "bg-rose-50" },
  { label: "Purple", className: "bg-purple-50", swatch: "bg-purple-50" },
  { label: "Indigo", className: "bg-indigo-50", swatch: "bg-indigo-50" },
  { label: "Blue", className: "bg-blue-50", swatch: "bg-blue-50" },
];

const BORDER_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Soft", value: "soft" },
  { label: "Medium", value: "medium" },
  { label: "Clear", value: "clear" },
  { label: "Strong", value: "strong" },
  { label: "Focus", value: "focus" },
];

const GRADIENT_PRESETS = [
  { label: "None", value: "" },
  { label: "Sunset", value: "linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)" },
  { label: "Ocean", value: "linear-gradient(135deg, #00b4db 0%, #0083b0 100%)" },
  { label: "Forest", value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { label: "Royal", value: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" },
  { label: "Fire", value: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)" },
  { label: "Frost", value: "linear-gradient(135deg, #93c5fd 0%, #e0f2fe 100%)" },
];

const HOVER_EFFECTS = ["none", "scale", "shadow", "glow"] as const;
const FONT_SIZES = ["xs", "sm", "base"] as const;
const TEXT_ALIGNS = ["left", "center", "right"] as const;
const HEIGHT_OPTIONS = [1, 2, 3] as const;
const DATE_FORMATS = ["EEE, MMM d", "MMM d, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "EEEE, MMMM d, yyyy", "d MMM yyyy"] as const;

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "widget-company-logo", type: "company-logo", visible: true, layout: { x: 0, y: 0, w: 12, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-fiscal-year", type: "fiscal-year", visible: true, layout: { x: 13, y: 0, w: 12, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-base-currency", type: "base-currency", visible: true, layout: { x: 26, y: 0, w: 12, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-approval-mode", type: "approval-mode", visible: true, layout: { x: 39, y: 0, w: 14, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-ui-mode", type: "ui-mode", visible: true, layout: { x: 54, y: 0, w: 14, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-date", type: "date", visible: true, layout: { x: 69, y: 0, w: 14, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-clock", type: "clock", visible: true, layout: { x: 84, y: 0, w: 12, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-notes", type: "notes", visible: false, layout: { x: 69, y: 0, w: 10, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
  { id: "widget-alarm", type: "alarm", visible: false, layout: { x: 80, y: 0, w: 10, h: 1, minW: 8 }, style: { showBorder: true, showBackground: true } },
];

const TopbarWidgetDesignerPage: React.FC = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { widgets, setWidgets, toggleWidget, updateWidgetStyle, updateWidgetLayouts, setLayoutMode } = useWidgetStore();

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setLayoutMode(true);
    return () => setLayoutMode(false);
  }, [setLayoutMode]);

  useEffect(() => {
    if (selectedWidgetId && !widgets.some((w) => w.id === selectedWidgetId)) {
      setSelectedWidgetId(null);
    }
  }, [selectedWidgetId, widgets]);

  const maxWidgetHeight = useMemo(
    () => Math.max(1, ...widgets.filter((w) => w.visible).map((w) => w.style?.height ?? 1)),
    [widgets],
  );

  const mockTopbarHeight =
    maxWidgetHeight === 1 ? "h-12" : maxWidgetHeight === 2 ? "h-20" : "h-28";

  const selectedWidget = useMemo(
    () => widgets.find((w) => w.id === selectedWidgetId) ?? null,
    [widgets, selectedWidgetId],
  );

  const widgetTypeLabel = (type: string) =>
    t(`widgets.types.${type}`, { defaultValue: type });

  const handleResetDefaults = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w, style: { ...w.style } as WidgetStyle })));
    setSelectedWidgetId(null);
    setShowResetConfirm(false);
  }, [setWidgets]);

  const handleAutoAlign = useCallback(() => {
    const activeWidgets = widgets.filter((w) => w.visible);
    if (activeWidgets.length === 0) return;
    const baseWidth = Math.floor(96 / activeWidgets.length);
    const extraCells = 96 % activeWidgets.length;
    let nextX = 0;
    updateWidgetLayouts(
      activeWidgets.map((w, i) => {
        const width = baseWidth + (i < extraCells ? 1 : 0);
        const layout = { i: w.id, x: nextX, y: 0, w: width, h: 1 };
        nextX += width;
        return layout;
      }),
    );
  }, [widgets, updateWidgetLayouts]);

  const handleStyleChange = useCallback(
    (id: string, patch: Partial<WidgetStyle>) => {
      updateWidgetStyle(id, patch);
    },
    [updateWidgetStyle],
  );

  const fieldClass =
    "h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-xs text-[var(--color-text-primary)]";

  return (
    <div className="mx-auto flex h-full max-w-full flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
              {t("widgets.managerTitle", "Workspace Widgets")}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("widgets.designer.subtitle", "Arrange, style, and manage your topbar widgets")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoAlign}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {t("widgets.autoAlign", "Auto Align")}
          </button>
          {showResetConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
              >
                {t("widgets.designer.confirmReset", "Confirm Reset")}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              >
                {t("widgets.designer.cancel", "Cancel")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("widgets.designer.resetDefaults", "Reset Defaults")}
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Check className="h-3.5 w-3.5" />
            {t("widgets.doneEditing", "Done")}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        {/* Left Panel — Widget Palette */}
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t("widgets.designer.palette", "Widget Palette")}
            </h2>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              {t("widgets.designer.paletteHint", "Toggle widgets on/off")}
            </p>
          </div>
          <div className="flex flex-col gap-0.5 p-2">
            {WIDGET_TYPES.map(({ type, icon }) => {
              const widget = widgets.find((w) => w.type === type);
              if (!widget) return null;
              return (
                <button
                  key={type}
                  onClick={() => { setSelectedWidgetId(widget.id); toggleWidget(widget.id); }}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all",
                    selectedWidgetId === widget.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-xs">{icon}</span>
                  <span className="flex-1 truncate">{widgetTypeLabel(type)}</span>
                  <span
                    className={clsx(
                      "h-2.5 w-2.5 shrink-0 rounded-full border shadow-inner",
                      widget.visible
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-slate-300 bg-slate-100",
                    )}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-auto border-t border-[var(--color-border)] px-4 py-2">
            <p className="text-[10px] italic text-[var(--color-text-muted)]">
              {t("widgets.designer.clickToEdit", "Click a widget in the preview to edit styles")}
            </p>
          </div>
        </aside>

        {/* Center — Preview Pane */}
        <main className="flex flex-1 flex-col overflow-hidden bg-[var(--color-bg-secondary)]">
          {/* Simulated topbar preview */}
          <div className="flex shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <LayoutTemplate className="h-3.5 w-3.5" />
              {t("widgets.designer.preview", "Preview")}
            </div>
          </div>
          <div className="flex flex-1 items-start justify-center p-6">
            <div
              className={clsx(
                "w-full max-w-5xl overflow-hidden rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm transition-all",
                "hover:border-indigo-300",
              )}
            >
              {/* Mock topbar */}
              <div
                className={`flex ${mockTopbarHeight} items-center border-b border-[var(--color-border)] px-3 transition-all duration-300`}
                onClick={() => setSelectedWidgetId(null)}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <div className="mx-2 h-6 w-px bg-[var(--color-border)]" />
                <DraggableWidgetSpace forceLayoutMode onWidgetSelect={setSelectedWidgetId} />
              </div>
              <div className="flex flex-1 flex-col">
                {/* Mock page content */}
                <div className={`flex items-center justify-center ${selectedWidget ? 'p-4' : 'p-12'}`}>
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100" />
                    <div className="mx-auto mb-2 h-3 w-48 rounded bg-slate-100" />
                    <div className="mx-auto h-2 w-32 rounded bg-slate-50" />
                  </div>
                </div>
                {/* Large widget preview */}
                {selectedWidget ? (
                  <LargeWidgetPreview widget={selectedWidget} widgetTypeLabel={widgetTypeLabel} />
                ) : null}
              </div>
            </div>
          </div>
        </main>

        {/* Right Panel — Style Editor */}
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          {selectedWidget ? (
            <StyleEditorPanel
              widget={selectedWidget}
              widgetTypeLabel={widgetTypeLabel}
              onStyleChange={handleStyleChange}
              fieldClass={fieldClass}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Square className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("widgets.designer.noSelection", "Select a widget")}
                </p>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  {t("widgets.designer.noSelectionHint", "Click a widget in the preview above")}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

// ---- Style Editor Panel ----

interface StyleEditorPanelProps {
  widget: WidgetConfig;
  widgetTypeLabel: (type: string) => string;
  onStyleChange: (id: string, patch: Partial<WidgetStyle>) => void;
  fieldClass: string;
}

const StyleEditorPanel: React.FC<StyleEditorPanelProps> = ({
  widget,
  widgetTypeLabel,
  onStyleChange,
  fieldClass,
}) => {
  const { t } = useTranslation("common");
  const style = widget.style ?? { showBorder: true, showBackground: true };
  const bgColor = style.bgColor ?? (style.showBackground === false ? "bg-transparent" : "bg-white");
  const [editWidth, setEditWidth] = useState(String(widget.layout.w));

  useEffect(() => {
    setEditWidth(String(widget.layout.w));
  }, [widget.layout.w]);

  const { updateWidgetLayouts, toggleWidget } = useWidgetStore();
  const borderStyle = style.borderStyle || "solid";
  const borderWidth = style.borderWidth || "1px";
  const opacityVal = style.opacity ?? 100;
  const shadow = style.shadow || "none";

  const setBorder = (patch: Partial<WidgetStyle>) => onStyleChange(widget.id, patch);

  return (
    <div className="flex flex-col gap-0">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
            {widgetTypeLabel(widget.type).charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              {widgetTypeLabel(widget.type)}
            </h3>
            <p className="text-[10px] text-[var(--color-text-muted)]">{widget.id}</p>
          </div>
        </div>
      </div>

      <Section label={t("widgets.designer.visibility", "Visibility")}>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={widget.visible}
            onChange={() => toggleWidget(widget.id)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {widget.visible ? t("widgets.designer.visible", "Visible") : t("widgets.designer.hidden", "Hidden")}
          </span>
        </label>
      </Section>

      <Section label={t("widgets.designer.width", "Width (cells)")}>
        <div className="flex items-center gap-1">
          <button onClick={() => updateWidgetLayouts([{ i: widget.id, x: widget.layout.x, y: 0, w: Math.max(8, (widget.layout.w || 8) - 2), h: 1 }])}
            className="rounded border border-[var(--color-border)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <input type="text" value={editWidth} onChange={(e) => setEditWidth(e.target.value)}
            onBlur={() => { const p = Number.parseInt(editWidth, 10); if (Number.isFinite(p) && p >= 8 && p <= 96) updateWidgetLayouts([{ i: widget.id, x: widget.layout.x, y: 0, w: p, h: 1 }]); else setEditWidth(String(widget.layout.w)); }}
            className={fieldClass} />
          <button onClick={() => updateWidgetLayouts([{ i: widget.id, x: widget.layout.x, y: 0, w: Math.min(96, (widget.layout.w || 8) + 2), h: 1 }])}
            className="rounded border border-[var(--color-border)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Section>

      {/* ==================== BACKGROUND ==================== */}
      <Section label={t("widgets.designer.background", "Background")}>
        <div className="flex flex-wrap gap-1">
          {BG_OPTIONS.map((o) => (
            <button key={o.className}
              onClick={() => setBorder({ bgColor: o.className, customBgColor: undefined, showBackground: o.className !== "bg-transparent" })}
              className={clsx("h-6 w-6 rounded border border-slate-200 ring-offset-1 hover:ring-2 hover:ring-indigo-300", o.swatch,
                o.className === "bg-transparent" && "bg-white bg-[linear-gradient(135deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)]",
                !style.customBgColor && bgColor === o.className && "ring-2 ring-indigo-500")}
              title={o.label} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input type="color" value={style.customBgColor || "#f8fafc"}
            onChange={(e) => setBorder({ customBgColor: e.target.value, bgColor: "bg-transparent", showBackground: true })}
            className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5" />
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {style.customBgColor ? t("widgets.designer.customColor", "Custom") : t("widgets.designer.pickColor", "Pick a color")}
          </span>
        </div>
      </Section>

      {/* ==================== TEXT COLOR ==================== */}
      <Section label={t("widgets.designer.textColor", "Text Color")}>
        <div className="flex items-center gap-2">
          <input type="color" value={style.textColor || "#1e293b"}
            onChange={(e) => setBorder({ textColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5" />
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {style.textColor ? style.textColor : t("widgets.designer.defaultColor", "Default")}
          </span>
          {style.textColor ? (
            <button onClick={() => setBorder({ textColor: undefined })}
              className="ml-auto text-[10px] font-bold text-red-500 hover:text-red-700">
              {t("widgets.designer.reset", "Reset")}
            </button>
          ) : null}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={!!style.isBold}
            onChange={() => setBorder({ isBold: !style.isBold })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-xs font-bold text-[var(--color-text-primary)]">
            {t("widgets.designer.bold", "Bold text")}
          </span>
        </label>
      </Section>

      {/* ==================== BORDER STYLE ==================== */}
      <Section label={t("widgets.designer.borderStyle", "Border Style")}>
        <div className="flex flex-wrap gap-1">
          {(["solid", "dashed", "dotted", "double", "none"] as const).map((s) => (
            <button key={s} onClick={() => setBorder({ borderStyle: s, showBorder: s !== "none" })}
              className={clsx("rounded-md border px-2.5 py-1 text-[10px] font-bold transition-all",
                borderStyle === s ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {s === "none" ? "None" : s}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== BORDER WIDTH ==================== */}
      <Section label={t("widgets.designer.borderWidth", "Border Width")}>
        <div className="flex gap-1">
          {(["0px", "1px", "2px", "3px", "4px"] as const).map((w) => (
            <button key={w} onClick={() => setBorder({ borderWidth: w, showBorder: w !== "0px" })}
              className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold transition-all",
                borderWidth === w ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {w.replace("px", "px")}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== BORDER COLOR ==================== */}
      <Section label={t("widgets.designer.borderColor", "Border Color")}>
        <div className="flex items-center gap-2">
          <input type="color" value={style.borderColor || "#cbd5e1"}
            onChange={(e) => setBorder({ borderColor: e.target.value, showBorder: true })}
            className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5" />
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {style.borderColor ? style.borderColor : t("widgets.designer.defaultColor", "Default")}
          </span>
          {style.borderColor ? (
            <button onClick={() => setBorder({ borderColor: undefined })}
              className="ml-auto text-[10px] font-bold text-red-500 hover:text-red-700">
              {t("widgets.designer.reset", "Reset")}
            </button>
          ) : null}
        </div>
      </Section>

      {/* ==================== CORNERS ==================== */}
      <Section label={t("widgets.designer.corners", "Corners")}>
        <div className="flex gap-1">
          {(["0", "2px", "4px", "6px", "8px", "12px", "16px", "9999px"] as const).map((r) => (
            <button key={r} onClick={() => setBorder({ borderRadius: r })}
              className={clsx("rounded-md border px-2 py-1 text-[9px] font-bold transition-all",
                (style.borderRadius || "6px") === r ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {r === "9999px" ? "Full" : r === "0" ? "0" : r}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== SHADOW ==================== */}
      <Section label={t("widgets.designer.shadow", "Shadow")}>
        <div className="flex gap-1">
          {(["none", "sm", "md", "lg", "xl"] as const).map((s) => (
            <button key={s} onClick={() => setBorder({ shadow: s })}
              className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold transition-all",
                shadow === s ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {s === "none" ? "Off" : s.toUpperCase()}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== OPACITY ==================== */}
      <Section label={t("widgets.designer.opacity", "Opacity")}>
        <div className="flex items-center gap-2">
          <input type="range" min={40} max={100} value={opacityVal}
            onChange={(e) => setBorder({ opacity: Number(e.target.value) })}
            className="flex-1 accent-indigo-600" />
          <span className="w-8 text-right text-[11px] font-bold text-[var(--color-text-primary)]">{opacityVal}%</span>
        </div>
      </Section>

      {/* ==================== PADDING ==================== */}
      <Section label={t("widgets.designer.padding", "Padding")}>
        <div className="flex gap-1">
          {(["none", "small", "medium", "large"] as const).map((v) => (
            <button key={v} onClick={() => setBorder({ padding: v })}
              className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold uppercase transition-all",
                (style.padding ?? "small") === v ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {v === "none" ? "0" : v === "small" ? "Sm" : v === "medium" ? "Md" : "Lg"}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== FONT SIZE ==================== */}
      <Section label={t("widgets.designer.fontSize", "Font Size")}>
        <div className="flex gap-1">
          {FONT_SIZES.map((v) => (
            <button key={v} onClick={() => setBorder({ fontSize: v })}
              className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold transition-all",
                (style.fontSize ?? "sm") === v ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {v === "xs" ? "XS" : v === "sm" ? "Sm" : "Base"}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== TEXT ALIGNMENT ==================== */}
      <Section label={t("widgets.designer.textAlignment", "Text Alignment")}>
        <div className="flex gap-1">
          {TEXT_ALIGNS.map((v) => (
            <button key={v} onClick={() => setBorder({ textAlign: v })}
              className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold transition-all",
                (style.textAlign ?? "center") === v ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {v === "left" ? "⊢" : v === "center" ? "⊣⊢" : "⊣"}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== HEIGHT (ROWS) ==================== */}
      <Section label={t("widgets.designer.heightRows", "Height (rows)")}>
        <div className="flex gap-1">
          {HEIGHT_OPTIONS.map((v) => (
            <button key={v} onClick={() => setBorder({ height: v })}
              className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold transition-all",
                (style.height ?? 1) === v ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {v === 1 ? "1 Row" : v === 2 ? "2 Rows" : "3 Rows"}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== HOVER EFFECT ==================== */}
      <Section label={t("widgets.designer.hoverEffect", "Hover Effect")}>
        <div className="flex flex-wrap gap-1">
          {HOVER_EFFECTS.map((v) => (
            <button key={v} onClick={() => setBorder({ hoverEffect: v })}
              className={clsx("rounded-md border px-2.5 py-1 text-[10px] font-bold transition-all",
                (style.hoverEffect ?? "none") === v ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
              {v === "none" ? "Off" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      {/* ==================== GRADIENT BACKGROUND ==================== */}
      <Section label={t("widgets.designer.gradientBg", "Gradient Background")}>
        <div className="flex flex-wrap gap-1">
          {GRADIENT_PRESETS.map((g) => (
            <button key={g.label} onClick={() => setBorder({ gradientBg: g.value, customBgColor: undefined, bgColor: g.value ? "bg-transparent" : undefined, showBackground: !!g.value })}
              className={clsx("h-6 w-6 rounded border border-slate-200 ring-offset-1 hover:ring-2 hover:ring-indigo-300",
                (style.gradientBg ?? "") === g.value && "ring-2 ring-indigo-500",
                g.value ? "" : "bg-white bg-[linear-gradient(135deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)]")}
              style={g.value ? { background: g.value } : undefined}
              title={g.label} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {t("widgets.designer.gradientPresets", "Presets above")}
          </span>
        </div>
      </Section>

      {/* ==================== BACKDROP BLUR ==================== */}
      <Section label={t("widgets.designer.backdropBlur", "Backdrop Blur")}>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={!!style.backdropBlur}
            onChange={() => setBorder({ backdropBlur: !style.backdropBlur })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {style.backdropBlur ? t("widgets.designer.blurOn", "Blur On") : t("widgets.designer.blurOff", "Blur Off")}
          </span>
        </label>
      </Section>

      {/* ==================== CLOCK FORMAT (clock only) ==================== */}
      {widget.type === "clock" ? (
        <Section label={t("widgets.designer.clockFormat", "Clock Format")}>
          <div className="flex gap-1">
            {(["12h", "24h"] as const).map((v) => (
              <button key={v} onClick={() => setBorder({ clockFormat: v })}
                className={clsx("flex-1 rounded-md border py-1 text-[10px] font-bold transition-all",
                  (style.clockFormat ?? "24h") === v ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
                {v === "12h" ? "12h AM/PM" : "24h"}
              </button>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={style.showSeconds !== false}
              onChange={() => setBorder({ showSeconds: style.showSeconds === false ? true : false })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">
              {t("widgets.designer.showSeconds", "Show seconds")}
            </span>
          </label>
        </Section>
      ) : null}

      {/* ==================== DATE FORMAT (date only) ==================== */}
      {widget.type === "date" ? (
        <Section label={t("widgets.designer.dateFormat", "Date Format")}>
          <div className="flex flex-wrap gap-1">
            {DATE_FORMATS.map((f) => (
              <button key={f} onClick={() => setBorder({ dateFormat: f })}
                className={clsx("rounded-md border px-2 py-1 text-[9px] font-bold transition-all",
                  (style.dateFormat ?? "EEE, MMM d") === f ? "bg-indigo-50 text-indigo-700 border-indigo-300" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]")}>
                {f}
              </button>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
};

// ---- Section helper ----

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ label, children }) => (
  <div className="border-b border-[var(--color-border)] px-4 py-3">
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
      {label}
    </label>
    {children}
  </div>
);

// ---- Large Widget Preview ----

const SHADOW_MAP: Record<string, string> = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
};

interface LargeWidgetPreviewProps {
  widget: WidgetConfig;
  widgetTypeLabel: (type: string) => string;
}

const LargeWidgetPreview: React.FC<LargeWidgetPreviewProps> = ({ widget, widgetTypeLabel }) => {
  const { t } = useTranslation("common");
  const style = widget.style ?? { showBorder: true, showBackground: true };
  const Component = WIDGET_COMPONENT_MAP[widget.type];
  const customBg = style.customBgColor;
  const bgColor = style.bgColor ?? (style.showBackground === false ? "bg-transparent" : "bg-white");

  if (!Component) return null;

  const previewStyle: React.CSSProperties = {
    ...(customBg && !style.gradientBg ? { backgroundColor: customBg } : {}),
    ...(style.textColor ? { color: style.textColor } : {}),
    ...(style.borderColor ? { borderColor: style.borderColor } : {}),
    ...(style.borderWidth ? { borderWidth: style.borderWidth } : {}),
    ...(style.borderStyle ? { borderStyle: style.borderStyle } : {}),
    ...(style.borderRadius ? { borderRadius: style.borderRadius } : {}),
    ...(style.shadow && style.shadow !== "none" ? { boxShadow: SHADOW_MAP[style.shadow] } : {}),
    ...(style.opacity !== undefined && style.opacity < 100 ? { opacity: style.opacity / 100 } : {}),
    ...(style.fontSize ? { fontSize: style.fontSize === "xs" ? "10px" : style.fontSize === "sm" ? "12px" : "14px" } : {}),
    ...(style.textAlign ? { textAlign: style.textAlign } : {}),
    ...(style.gradientBg ? { background: style.gradientBg } : {}),
    ...(style.backdropBlur ? { backdropFilter: "blur(4px)" } : {}),
    ...(style.padding === "none" ? { padding: "0" } : style.padding === "small" ? { padding: "0.375rem" } : style.padding === "medium" ? { padding: "0.625rem" } : { padding: "1rem" }),
  };

  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[9px] font-bold text-indigo-700">
          {widgetTypeLabel(widget.type).charAt(0)}
        </div>
        <span className="text-xs font-bold text-[var(--color-text-primary)]">
          {widgetTypeLabel(widget.type)}
        </span>
        <span className="text-[9px] text-[var(--color-text-muted)]">
          {t("widgets.designer.livePreview", "Live Preview")}
        </span>
      </div>
      <div
        style={previewStyle}
        className={clsx(
          "flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)]",
          customBg ? "" : bgColor,
          style.hoverEffect === "scale" && "hover:scale-105 transition-transform duration-200",
          style.hoverEffect === "shadow" && "hover:shadow-lg transition-shadow duration-200",
          style.hoverEffect === "glow" && "hover:shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-shadow duration-200",
          style.backdropBlur && "backdrop-blur-sm",
          style.isBold && "[&_*]:!font-black",
        )}
      >
        <div className="flex h-3/4 w-3/4 items-center justify-center overflow-hidden rounded-md">
          <Component
            showBorder={false}
            showBackground={false}
            clockFormat={style.clockFormat}
            showSeconds={style.showSeconds}
            dateFormat={style.dateFormat}
          />
        </div>
      </div>
    </div>
  );
};

export default TopbarWidgetDesignerPage;
