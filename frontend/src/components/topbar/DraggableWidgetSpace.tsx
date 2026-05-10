import React, { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  PaintBucket,
  Square,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWidgetStore, WidgetConfig, WidgetStyle } from "../../store/widgetStore";
import { ClockWidget } from "./widgets/ClockWidget";
import { DateWidget } from "./widgets/DateWidget";
import { NotesWidget } from "./widgets/NotesWidget";
import { AlarmWidget } from "./widgets/AlarmWidget";
import { CompanyLogoNameWidget } from "./widgets/CompanyLogoNameWidget";
import { FiscalYearWidget } from "./widgets/FiscalYearWidget";
import { BaseCurrencyWidget } from "./widgets/BaseCurrencyWidget";
import { ApprovalModeWidget } from "./widgets/ApprovalModeWidget";
import { UIModeWidget } from "./widgets/UIModeWidget";

const WidgetMap: Record<string, React.FC<any>> = {
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

const MAX_CELLS = 96;
const MIN_WIDGET_SPAN = 8;
const GRID_STYLE = {
  gridTemplateColumns: `repeat(${MAX_CELLS}, minmax(0, 1fr))`,
};

const WIDGET_SPAN_BY_TYPE: Record<string, number> = {
  "company-logo": 12,
  "fiscal-year": 12,
  "base-currency": 12,
  "approval-mode": 14,
  "ui-mode": 14,
  clock: 10,
  date: 12,
  notes: 10,
  alarm: 10,
};

const BG_OPTIONS = [
  { label: "None", className: "bg-transparent", swatch: "bg-white" },
  { label: "White", className: "bg-white", swatch: "bg-white" },
  { label: "Zinc", className: "bg-zinc-50", swatch: "bg-zinc-50" },
  { label: "Slate", className: "bg-slate-50", swatch: "bg-slate-50" },
  { label: "Stone", className: "bg-stone-50", swatch: "bg-stone-50" },
  { label: "Red", className: "bg-red-50", swatch: "bg-red-50" },
  { label: "Orange", className: "bg-orange-50", swatch: "bg-orange-50" },
  { label: "Sky", className: "bg-sky-50", swatch: "bg-sky-50" },
  { label: "Cyan", className: "bg-cyan-50", swatch: "bg-cyan-50" },
  { label: "Teal", className: "bg-teal-50", swatch: "bg-teal-50" },
  { label: "Emerald", className: "bg-emerald-50", swatch: "bg-emerald-50" },
  { label: "Lime", className: "bg-lime-50", swatch: "bg-lime-50" },
  { label: "Yellow", className: "bg-yellow-50", swatch: "bg-yellow-50" },
  { label: "Amber", className: "bg-amber-50", swatch: "bg-amber-50" },
  { label: "Rose", className: "bg-rose-50", swatch: "bg-rose-50" },
  { label: "Pink", className: "bg-pink-50", swatch: "bg-pink-50" },
  { label: "Fuchsia", className: "bg-fuchsia-50", swatch: "bg-fuchsia-50" },
  { label: "Purple", className: "bg-purple-50", swatch: "bg-purple-50" },
  { label: "Violet", className: "bg-violet-50", swatch: "bg-violet-50" },
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

const BORDER_COLOR_BY_BG: Record<string, Record<string, string>> = {
  "bg-red-50": {
    soft: "border border-red-200 shadow-sm",
    medium: "border border-red-300 shadow-sm",
    clear: "border border-red-400 shadow-sm",
    strong: "border-2 border-red-400 shadow-sm",
    focus: "border border-red-300 ring-1 ring-red-200 shadow-sm",
  },
  "bg-orange-50": {
    soft: "border border-orange-200 shadow-sm",
    medium: "border border-orange-300 shadow-sm",
    clear: "border border-orange-400 shadow-sm",
    strong: "border-2 border-orange-400 shadow-sm",
    focus: "border border-orange-300 ring-1 ring-orange-200 shadow-sm",
  },
  "bg-sky-50": {
    soft: "border border-sky-200 shadow-sm",
    medium: "border border-sky-300 shadow-sm",
    clear: "border border-sky-400 shadow-sm",
    strong: "border-2 border-sky-400 shadow-sm",
    focus: "border border-sky-300 ring-1 ring-sky-200 shadow-sm",
  },
  "bg-cyan-50": {
    soft: "border border-cyan-200 shadow-sm",
    medium: "border border-cyan-300 shadow-sm",
    clear: "border border-cyan-400 shadow-sm",
    strong: "border-2 border-cyan-400 shadow-sm",
    focus: "border border-cyan-300 ring-1 ring-cyan-200 shadow-sm",
  },
  "bg-teal-50": {
    soft: "border border-teal-200 shadow-sm",
    medium: "border border-teal-300 shadow-sm",
    clear: "border border-teal-400 shadow-sm",
    strong: "border-2 border-teal-400 shadow-sm",
    focus: "border border-teal-300 ring-1 ring-teal-200 shadow-sm",
  },
  "bg-emerald-50": {
    soft: "border border-emerald-200 shadow-sm",
    medium: "border border-emerald-300 shadow-sm",
    clear: "border border-emerald-400 shadow-sm",
    strong: "border-2 border-emerald-400 shadow-sm",
    focus: "border border-emerald-300 ring-1 ring-emerald-200 shadow-sm",
  },
  "bg-lime-50": {
    soft: "border border-lime-200 shadow-sm",
    medium: "border border-lime-300 shadow-sm",
    clear: "border border-lime-400 shadow-sm",
    strong: "border-2 border-lime-400 shadow-sm",
    focus: "border border-lime-300 ring-1 ring-lime-200 shadow-sm",
  },
  "bg-yellow-50": {
    soft: "border border-yellow-200 shadow-sm",
    medium: "border border-yellow-300 shadow-sm",
    clear: "border border-yellow-400 shadow-sm",
    strong: "border-2 border-yellow-400 shadow-sm",
    focus: "border border-yellow-300 ring-1 ring-yellow-200 shadow-sm",
  },
  "bg-amber-50": {
    soft: "border border-amber-200 shadow-sm",
    medium: "border border-amber-300 shadow-sm",
    clear: "border border-amber-400 shadow-sm",
    strong: "border-2 border-amber-400 shadow-sm",
    focus: "border border-amber-300 ring-1 ring-amber-200 shadow-sm",
  },
  "bg-rose-50": {
    soft: "border border-rose-200 shadow-sm",
    medium: "border border-rose-300 shadow-sm",
    clear: "border border-rose-400 shadow-sm",
    strong: "border-2 border-rose-400 shadow-sm",
    focus: "border border-rose-300 ring-1 ring-rose-200 shadow-sm",
  },
  "bg-pink-50": {
    soft: "border border-pink-200 shadow-sm",
    medium: "border border-pink-300 shadow-sm",
    clear: "border border-pink-400 shadow-sm",
    strong: "border-2 border-pink-400 shadow-sm",
    focus: "border border-pink-300 ring-1 ring-pink-200 shadow-sm",
  },
  "bg-fuchsia-50": {
    soft: "border border-fuchsia-200 shadow-sm",
    medium: "border border-fuchsia-300 shadow-sm",
    clear: "border border-fuchsia-400 shadow-sm",
    strong: "border-2 border-fuchsia-400 shadow-sm",
    focus: "border border-fuchsia-300 ring-1 ring-fuchsia-200 shadow-sm",
  },
  "bg-purple-50": {
    soft: "border border-purple-200 shadow-sm",
    medium: "border border-purple-300 shadow-sm",
    clear: "border border-purple-400 shadow-sm",
    strong: "border-2 border-purple-400 shadow-sm",
    focus: "border border-purple-300 ring-1 ring-purple-200 shadow-sm",
  },
  "bg-violet-50": {
    soft: "border border-violet-200 shadow-sm",
    medium: "border border-violet-300 shadow-sm",
    clear: "border border-violet-400 shadow-sm",
    strong: "border-2 border-violet-400 shadow-sm",
    focus: "border border-violet-300 ring-1 ring-violet-200 shadow-sm",
  },
  "bg-indigo-50": {
    soft: "border border-indigo-200 shadow-sm",
    medium: "border border-indigo-300 shadow-sm",
    clear: "border border-indigo-400 shadow-sm",
    strong: "border-2 border-indigo-400 shadow-sm",
    focus: "border border-indigo-300 ring-1 ring-indigo-200 shadow-sm",
  },
  "bg-blue-50": {
    soft: "border border-blue-200 shadow-sm",
    medium: "border border-blue-300 shadow-sm",
    clear: "border border-blue-400 shadow-sm",
    strong: "border-2 border-blue-400 shadow-sm",
    focus: "border border-blue-300 ring-1 ring-blue-200 shadow-sm",
  },
};

const NEUTRAL_BORDER_BY_VARIANT: Record<string, string> = {
  soft: "border border-slate-200 shadow-sm",
  medium: "border border-slate-300 shadow-sm",
  clear: "border border-slate-400 shadow-sm",
  strong: "border-2 border-slate-400 shadow-sm",
  focus: "border border-sky-300 ring-1 ring-sky-200 shadow-sm",
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clampSpan = (span: number) =>
  clamp(Number.isFinite(span) ? span : MIN_WIDGET_SPAN, MIN_WIDGET_SPAN, MAX_CELLS);

const getBorderClass = (bgColor = "bg-transparent", variant = "medium") =>
  BORDER_COLOR_BY_BG[bgColor]?.[variant] ?? NEUTRAL_BORDER_BY_VARIANT[variant] ?? "";

const getWidgetSpan = (widget: WidgetConfig) =>
  clampSpan(widget.layout?.w ?? WIDGET_SPAN_BY_TYPE[widget.type] ?? MIN_WIDGET_SPAN);

const getWidgetColStart = (widget: WidgetConfig, span: number) =>
  clamp((widget.layout?.x ?? 0) + 1, 1, MAX_CELLS - span + 1);

const hasCollision = (
  widgets: WidgetConfig[],
  candidate: { id: string; x: number; w: number },
) => {
  const candidateStart = candidate.x;
  const candidateEnd = candidate.x + candidate.w;

  return widgets.some((widget) => {
    if (widget.id === candidate.id || !widget.visible) return false;
    const span = getWidgetSpan(widget);
    const start = getWidgetColStart(widget, span) - 1;
    const end = start + span;
    return candidateStart < end && candidateEnd > start;
  });
};

const findFirstAvailableSpace = (
  widgets: WidgetConfig[],
  span: number,
  preferredColStart = 1,
  ignoreId?: string,
) => {
  const safeSpan = clampSpan(span);
  const maxStart = MAX_CELLS - safeSpan + 1;
  const preferred = clamp(preferredColStart, 1, maxStart);
  const candidates: number[] = [];

  for (let col = preferred; col <= maxStart; col += 1) candidates.push(col);
  for (let col = preferred - 1; col >= 1; col -= 1) candidates.push(col);

  for (const colStart of candidates) {
    const candidate = { id: ignoreId ?? "__new__", x: colStart - 1, w: safeSpan };
    if (!hasCollision(widgets, candidate)) return colStart;
  }

  return 1;
};

interface PrecisionWidgetProps {
  widget: WidgetConfig;
  colStart: number;
  span: number;
  isLayoutMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, colStart: number) => void;
  onResize: (id: string, span: number) => void;
  onStyleChange: (id: string, style: Partial<WidgetStyle>) => void;
}

const PrecisionWidget: React.FC<PrecisionWidgetProps> = ({
  widget,
  colStart,
  span,
  isLayoutMode,
  isSelected,
  onSelect,
  onMove,
  onResize,
  onStyleChange,
}) => {
  const { t } = useTranslation("common");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    disabled: !isLayoutMode,
  });
  const [editSpan, setEditSpan] = useState(String(span));
  const [isBgPanelOpen, setIsBgPanelOpen] = useState(false);
  const [isBorderPanelOpen, setIsBorderPanelOpen] = useState(false);
  const Component = WidgetMap[widget.type];
  const style = widget.style ?? { showBorder: true, showBackground: true };
  const padding = style.padding ?? "small";
  const bgColor = style.bgColor ?? (style.showBackground === false ? "bg-transparent" : "bg-white");
  const borderClass = style.showBorder ? getBorderClass(bgColor, style.borderVariant) : "";

  useEffect(() => {
    setEditSpan(String(span));
  }, [span]);

  useEffect(() => {
    if (!isSelected) {
      setIsBgPanelOpen(false);
      setIsBorderPanelOpen(false);
    }
  }, [isSelected]);

  if (!Component) return null;

  const handleSpanInput = (value: string) => {
    setEditSpan(value);
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onResize(widget.id, parsed);
    }
  };

  const cssStyle: React.CSSProperties = {
    gridColumn: `${colStart} / span ${span}`,
    gridRow: 1,
    transform: CSS.Transform.toString(transform),
    zIndex: isDragging ? 80 : isLayoutMode && isSelected ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={cssStyle}
      onClick={() => onSelect(widget.id)}
      className={clsx(
        "relative group flex h-full min-h-0 min-w-0 items-center self-stretch transition-shadow",
        isDragging && "opacity-80 shadow-xl",
      )}
    >
      <div
        className={clsx(
          "box-border flex h-full max-h-full w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md text-[11px] text-[var(--color-text-primary)]",
          bgColor,
          borderClass,
          style.isBold && "[&_*]:!font-black",
          padding === "none" && "px-0 py-0",
          padding === "small" && "px-1.5 py-1",
          padding === "medium" && "px-2.5 py-1",
          padding === "large" && "px-4 py-1",
          isLayoutMode && "ring-1 ring-inset ring-sky-200",
          isLayoutMode && isSelected && "ring-2 ring-inset ring-sky-500",
        )}
      >
        {isLayoutMode ? (
          <button
            {...attributes}
            {...listeners}
            className="no-drag shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 active:cursor-grabbing"
            title={t("widgets.dragWidget", "Drag widget")}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <div className="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
          <Component showBorder={false} showBackground={false} />
        </div>
      </div>

      {isLayoutMode && isSelected && !isDragging ? (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-[210] flex -translate-x-1/2 justify-center">
          <div
            className="no-drag flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center overflow-hidden rounded border border-slate-200 bg-slate-50">
              <button
                onClick={() => onMove(widget.id, colStart - 1)}
                className="p-1 text-slate-500 hover:bg-white hover:text-sky-700"
                title={t("widgets.moveLeft", "Move left")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex h-7 items-center border-x border-slate-200 bg-white px-1.5">
                <span className="mr-1 text-[10px] font-bold text-slate-400">W</span>
                <input
                  type="text"
                  value={editSpan}
                  onChange={(event) => handleSpanInput(event.target.value)}
                  onBlur={() => setEditSpan(String(span))}
                  className="h-6 w-7 bg-transparent text-center font-mono text-xs font-bold outline-none"
                />
              </div>
              <button
                onClick={() => onMove(widget.id, colStart + 1)}
                className="p-1 text-slate-500 hover:bg-white hover:text-sky-700"
                title={t("widgets.moveRight", "Move right")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative ml-1 flex items-center">
              <button
                onClick={() => onStyleChange(widget.id, { isBold: !style.isBold })}
                className={clsx(
                  "rounded p-1 hover:bg-slate-100",
                  style.isBold ? "text-sky-700" : "text-slate-400",
                )}
                title={t("widgets.bold", "Bold")}
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsBorderPanelOpen((value) => !value);
                  setIsBgPanelOpen(false);
                }}
                className={clsx(
                  "rounded p-1 hover:bg-slate-100",
                  style.showBorder ? "text-sky-700" : "text-slate-400",
                )}
                title={t("widgets.border", "Border")}
              >
                <Square className="h-3.5 w-3.5" />
              </button>
              {isBorderPanelOpen ? (
                <div className="absolute right-0 top-[calc(100%+6px)] z-[220] flex w-32 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                  {BORDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onStyleChange(widget.id, {
                          showBorder: option.value !== "none",
                          borderVariant: option.value,
                        });
                        setIsBorderPanelOpen(false);
                      }}
                      className={clsx(
                        "flex w-24 items-center justify-between rounded px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50",
                        (style.borderVariant ?? "medium") === option.value && "bg-sky-50 text-sky-700",
                      )}
                      title={option.label}
                    >
                      <span>{option.label}</span>
                      <span
                        className={clsx(
                          "h-3 w-5 rounded bg-white",
                          option.value === "none" ? "border-0" : getBorderClass(bgColor, option.value),
                        )}
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                onClick={() => {
                  setIsBgPanelOpen((value) => !value);
                  setIsBorderPanelOpen(false);
                }}
                className={clsx(
                  "rounded p-1 hover:bg-slate-100",
                  bgColor !== "bg-transparent" ? "text-sky-700" : "text-slate-400",
                )}
                title={t("widgets.background", "Background")}
              >
                <PaintBucket className="h-3.5 w-3.5" />
              </button>
              {isBgPanelOpen ? (
                <div className="absolute right-0 top-[calc(100%+6px)] z-[220] flex w-max min-w-max flex-nowrap gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                  {BG_OPTIONS.map((option) => (
                    <button
                      key={option.className}
                      onClick={() => {
                        onStyleChange(widget.id, {
                          bgColor: option.className,
                          showBackground: option.className !== "bg-transparent",
                        });
                        setIsBgPanelOpen(false);
                      }}
                      className={clsx(
                        "h-5 w-5 rounded border border-slate-200 ring-offset-1 hover:ring-2 hover:ring-sky-300",
                        option.swatch,
                        option.className === "bg-transparent" &&
                          "bg-white bg-[linear-gradient(135deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)]",
                        bgColor === option.className && "ring-2 ring-sky-500",
                      )}
                      title={option.label}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const DraggableWidgetSpace: React.FC = () => {
  const { widgets, updateWidgetLayouts, isLayoutMode, updateWidgetStyle } = useWidgetStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const visibleWidgets = useMemo(
    () => widgets.filter((widget) => widget.visible && WidgetMap[widget.type]),
    [widgets],
  );

  const orderedWidgets = useMemo(
    () =>
      [...visibleWidgets].sort((a, b) => {
        const aSpan = getWidgetSpan(a);
        const bSpan = getWidgetSpan(b);
        return getWidgetColStart(a, aSpan) - getWidgetColStart(b, bSpan);
      }),
    [visibleWidgets],
  );

  const positionedWidgets = useMemo(() => {
    let nextColStart = 1;
    return orderedWidgets.map((widget) => {
      const span = getWidgetSpan(widget);
      const requestedColStart = getWidgetColStart(widget, span);
      const colStart = clamp(Math.max(requestedColStart, nextColStart), 1, MAX_CELLS - span + 1);
      nextColStart = colStart + span;
      return { widget, span, colStart };
    });
  }, [orderedWidgets]);

  useEffect(() => {
    if (selectedWidgetId && !visibleWidgets.some((widget) => widget.id === selectedWidgetId)) {
      setSelectedWidgetId(null);
    }
  }, [selectedWidgetId, visibleWidgets]);

  const persistWidgetLayout = (id: string, colStart: number, span: number) => {
    updateWidgetLayouts([
      {
        i: id,
        x: colStart - 1,
        y: 0,
        w: clampSpan(span),
        h: 1,
      },
    ]);
  };

  const moveWidget = (id: string, requestedColStart: number) => {
    const widget = widgets.find((item) => item.id === id);
    if (!widget) return;
    const span = getWidgetSpan(widget);
    const maxStart = MAX_CELLS - span + 1;
    const desired = clamp(requestedColStart, 1, maxStart);
    const colStart = findFirstAvailableSpace(widgets, span, desired, id);
    persistWidgetLayout(id, colStart, span);
  };

  const resizeWidget = (id: string, requestedSpan: number) => {
    const widget = widgets.find((item) => item.id === id);
    if (!widget) return;
    const span = clampSpan(requestedSpan);
    const currentSpan = getWidgetSpan(widget);
    const currentColStart = getWidgetColStart(widget, currentSpan);
    const colStart = findFirstAvailableSpace(widgets, span, currentColStart, id);
    persistWidgetLayout(id, colStart, span);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!containerRef.current) return;
    const active = positionedWidgets.find((item) => item.widget.id === event.active.id);
    if (!active) return;

    const cellWidth = containerRef.current.getBoundingClientRect().width / MAX_CELLS;
    const deltaCells = Math.round(event.delta.x / cellWidth);
    if (deltaCells !== 0) {
      moveWidget(active.widget.id, active.colStart + deltaCells);
    }
  };

  if (visibleWidgets.length === 0) {
    return <div className="flex-1 min-w-[200px]" />;
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={clsx(
        "box-border flex-1 h-full relative overflow-visible z-10 w-full min-w-[200px] transition-all duration-300 mx-1 p-1",
        isLayoutMode && "bg-sky-50/40 border-x border-sky-100",
      )}
    >
      {isLayoutMode ? (
        <div className="absolute inset-0 grid gap-0.5 opacity-25 pointer-events-none" style={GRID_STYLE}>
          {Array.from({ length: MAX_CELLS }).map((_, index) => (
            <div
              key={index}
              className={clsx(
                "h-full border-l border-sky-300",
                (index + 1) % 8 === 0 && "border-sky-500",
              )}
            />
          ))}
        </div>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="relative grid h-full items-stretch gap-0.5" style={GRID_STYLE}>
          {positionedWidgets.map(({ widget, span, colStart }) => (
            <PrecisionWidget
              key={widget.id}
              widget={widget}
              span={span}
              colStart={colStart}
              isLayoutMode={isLayoutMode}
              isSelected={selectedWidgetId === widget.id}
              onSelect={setSelectedWidgetId}
              onMove={moveWidget}
              onResize={resizeWidget}
              onStyleChange={updateWidgetStyle}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
};
