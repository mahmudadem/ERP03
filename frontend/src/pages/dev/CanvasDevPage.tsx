import React, { useMemo, useState, useEffect, useRef } from "react";
import { ResponsiveGridLayout, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { clsx } from "clsx";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Layers,
  LayoutTemplate,
  ListChecks,
  PaintBucket,
  Plus,
  RefreshCcw,
  Square,
  Trash2,
} from "lucide-react";
import { useWidgetStore } from "../../store/widgetStore";
import { ClockWidget } from "../../components/topbar/widgets/ClockWidget";
import { DateWidget } from "../../components/topbar/widgets/DateWidget";
import { NotesWidget } from "../../components/topbar/widgets/NotesWidget";
import { AlarmWidget } from "../../components/topbar/widgets/AlarmWidget";
import { CompanyLogoNameWidget } from "../../components/topbar/widgets/CompanyLogoNameWidget";
import { FiscalYearWidget } from "../../components/topbar/widgets/FiscalYearWidget";
import { BaseCurrencyWidget } from "../../components/topbar/widgets/BaseCurrencyWidget";
import { ApprovalModeWidget } from "../../components/topbar/widgets/ApprovalModeWidget";
import { UIModeWidget } from "../../components/topbar/widgets/UIModeWidget";
import { useTranslation } from "react-i18next";

// Dnd Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// ============================================================================
// IMPLEMENTATION 4: 96-CELL PRECISION TOPBAR SANDBOX
// ============================================================================
interface PrecisionWidgetConfig {
  id: string;
  type: string;
  span: number;
  colStart: number;
  label: string;
  styles?: {
    isBold?: boolean;
    hasBorder?: boolean;
    borderVariant?: string;
    bgColor?: string;
    padding?: 'none' | 'small' | 'medium' | 'large';
  };
}

interface WidgetTemplate {
  type: PrecisionWidgetConfig['type'];
  label: string;
  span: number;
}

const PRECISION_MAX_CELLS = 96;
const PRECISION_MIN_WIDGET_SPAN = 8;
const PRECISION_GRID_STYLE = {
  gridTemplateColumns: `repeat(${PRECISION_MAX_CELLS}, minmax(0, 1fr))`,
};

const PRECISION_BG_OPTIONS = [
  { label: 'None', className: 'bg-transparent', swatch: 'bg-white' },
  { label: 'White', className: 'bg-white', swatch: 'bg-white' },
  { label: 'Slate', className: 'bg-slate-50', swatch: 'bg-slate-50' },
  { label: 'Sky', className: 'bg-sky-50', swatch: 'bg-sky-50' },
  { label: 'Emerald', className: 'bg-emerald-50', swatch: 'bg-emerald-50' },
  { label: 'Amber', className: 'bg-amber-50', swatch: 'bg-amber-50' },
  { label: 'Rose', className: 'bg-rose-50', swatch: 'bg-rose-50' },
  { label: 'Indigo', className: 'bg-indigo-50', swatch: 'bg-indigo-50' },
];

const PRECISION_BORDER_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Soft', value: 'soft' },
  { label: 'Medium', value: 'medium' },
  { label: 'Clear', value: 'clear' },
  { label: 'Strong', value: 'strong' },
  { label: 'Focus', value: 'focus' },
];

const BORDER_COLOR_BY_BG: Record<string, Record<string, string>> = {
  'bg-sky-50': {
    soft: 'border border-sky-200 shadow-sm',
    medium: 'border border-sky-300 shadow-sm',
    clear: 'border border-sky-400 shadow-sm',
    strong: 'border-2 border-sky-400 shadow-sm',
    focus: 'border border-sky-300 ring-1 ring-sky-200 shadow-sm',
  },
  'bg-emerald-50': {
    soft: 'border border-emerald-200 shadow-sm',
    medium: 'border border-emerald-300 shadow-sm',
    clear: 'border border-emerald-400 shadow-sm',
    strong: 'border-2 border-emerald-400 shadow-sm',
    focus: 'border border-emerald-300 ring-1 ring-emerald-200 shadow-sm',
  },
  'bg-amber-50': {
    soft: 'border border-amber-200 shadow-sm',
    medium: 'border border-amber-300 shadow-sm',
    clear: 'border border-amber-400 shadow-sm',
    strong: 'border-2 border-amber-400 shadow-sm',
    focus: 'border border-amber-300 ring-1 ring-amber-200 shadow-sm',
  },
  'bg-rose-50': {
    soft: 'border border-rose-200 shadow-sm',
    medium: 'border border-rose-300 shadow-sm',
    clear: 'border border-rose-400 shadow-sm',
    strong: 'border-2 border-rose-400 shadow-sm',
    focus: 'border border-rose-300 ring-1 ring-rose-200 shadow-sm',
  },
  'bg-indigo-50': {
    soft: 'border border-indigo-200 shadow-sm',
    medium: 'border border-indigo-300 shadow-sm',
    clear: 'border border-indigo-400 shadow-sm',
    strong: 'border-2 border-indigo-400 shadow-sm',
    focus: 'border border-indigo-300 ring-1 ring-indigo-200 shadow-sm',
  },
};

const NEUTRAL_BORDER_BY_VARIANT: Record<string, string> = {
  soft: 'border border-slate-200 shadow-sm',
  medium: 'border border-slate-300 shadow-sm',
  clear: 'border border-slate-400 shadow-sm',
  strong: 'border-2 border-slate-400 shadow-sm',
  focus: 'border border-sky-300 ring-1 ring-sky-200 shadow-sm',
};

const getBorderClassForWidget = (bgColor = 'bg-transparent', variant = 'medium') =>
  BORDER_COLOR_BY_BG[bgColor]?.[variant] ?? NEUTRAL_BORDER_BY_VARIANT[variant] ?? '';

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { type: 'company-logo', label: 'Company Logo', span: 12 },
  { type: 'fiscal-year', label: 'Fiscal Year', span: 12 },
  { type: 'base-currency', label: 'Base Currency', span: 12 },
  { type: 'approval-mode', label: 'Approval Mode', span: 14 },
  { type: 'ui-mode', label: 'UI Mode', span: 14 },
  { type: 'clock', label: 'Clock', span: 10 },
  { type: 'date', label: 'Date', span: 12 },
  { type: 'notes', label: 'Notes', span: 10 },
  { type: 'alarm', label: 'Alarm', span: 10 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clampSpan = (span: number) =>
  clamp(Number.isFinite(span) ? span : PRECISION_MIN_WIDGET_SPAN, PRECISION_MIN_WIDGET_SPAN, PRECISION_MAX_CELLS);

const getWidgetEnd = (widget: Pick<PrecisionWidgetConfig, 'colStart' | 'span'>) =>
  widget.colStart + widget.span - 1;

const overlaps = (
  candidate: Pick<PrecisionWidgetConfig, 'colStart' | 'span'>,
  other: Pick<PrecisionWidgetConfig, 'colStart' | 'span'>,
) => candidate.colStart <= getWidgetEnd(other) && getWidgetEnd(candidate) >= other.colStart;

const hasCollision = (
  widgets: PrecisionWidgetConfig[],
  candidate: Pick<PrecisionWidgetConfig, 'id' | 'colStart' | 'span'>,
) => widgets.some((widget) => widget.id !== candidate.id && overlaps(candidate, widget));

const findFirstAvailableSpace = (
  widgets: PrecisionWidgetConfig[],
  span: number,
  preferredColStart = 1,
  ignoreId?: string,
) => {
  const safeSpan = clampSpan(span);
  const maxStart = PRECISION_MAX_CELLS - safeSpan + 1;
  const candidates: number[] = [];

  for (let col = clamp(preferredColStart, 1, maxStart); col <= maxStart; col += 1) {
    candidates.push(col);
  }
  for (let col = clamp(preferredColStart, 1, maxStart) - 1; col >= 1; col -= 1) {
    candidates.push(col);
  }

  for (const colStart of candidates) {
    const candidate = { id: ignoreId ?? '__new__', colStart, span: safeSpan };
    if (!hasCollision(widgets, candidate)) {
      return colStart;
    }
  }

  return 1;
};

const getTemplateLabel = (type: string) =>
  WIDGET_TEMPLATES.find((template) => template.type === type)?.label ?? type;

const createPrecisionWidgetsFromAppWidgets = (appWidgets: any[]): PrecisionWidgetConfig[] => {
  const visibleWidgets = appWidgets
    .filter((widget) => widget.visible && WidgetMap[widget.type])
    .sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0));

  if (visibleWidgets.length === 0) {
    return WIDGET_TEMPLATES.slice(0, 5).map((template, index) => ({
      id: `precision-${template.type}`,
      type: template.type,
      label: template.label,
      span: template.span,
      colStart: 1 + index * 15,
      styles: { hasBorder: true, bgColor: 'bg-transparent', padding: 'small' },
    }));
  }

  let nextColStart = 1;
  return visibleWidgets.map((widget) => {
    const template = WIDGET_TEMPLATES.find((item) => item.type === widget.type);
    const span = clampSpan(template?.span ?? Math.max(PRECISION_MIN_WIDGET_SPAN, (widget.layout?.w ?? 2) * 4));
    const requestedColStart = clamp(((widget.layout?.x ?? 0) * 4) + 1, 1, PRECISION_MAX_CELLS - span + 1);
    const colStart = Math.max(requestedColStart, nextColStart);
    nextColStart = Math.min(PRECISION_MAX_CELLS, colStart + span + 1);

    return {
      id: `precision-${widget.id}`,
      type: widget.type,
      label: template?.label ?? widget.type,
      span,
      colStart: clamp(colStart, 1, PRECISION_MAX_CELLS - span + 1),
      styles: {
        hasBorder: widget.style?.showBorder ?? true,
        bgColor: 'bg-transparent',
        padding: 'small',
      },
    };
  });
};

interface PrecisionWidgetProps {
  widget: PrecisionWidgetConfig;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, colStart: number) => void;
  onResize: (id: string, span: number) => void;
  onStyleChange: (id: string, styles: Partial<NonNullable<PrecisionWidgetConfig['styles']>>) => void;
  onRemove: (id: string) => void;
}

const PrecisionWidget: React.FC<PrecisionWidgetProps> = ({
  widget,
  isEditing,
  isSelected,
  onSelect,
  onMove,
  onResize,
  onStyleChange,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    disabled: !isEditing,
  });
  const [editSpan, setEditSpan] = useState(String(widget.span));
  const [isBgPanelOpen, setIsBgPanelOpen] = useState(false);
  const [isBorderPanelOpen, setIsBorderPanelOpen] = useState(false);
  const Component = WidgetMap[widget.type];
  const padding = widget.styles?.padding ?? 'medium';
  const borderClass = widget.styles?.hasBorder
    ? getBorderClassForWidget(widget.styles?.bgColor, widget.styles?.borderVariant)
    : '';

  useEffect(() => {
    setEditSpan(String(widget.span));
  }, [widget.span]);

  useEffect(() => {
    if (!isSelected) {
      setIsBgPanelOpen(false);
      setIsBorderPanelOpen(false);
    }
  }, [isSelected]);

  const handleSpanInput = (value: string) => {
    setEditSpan(value);
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onResize(widget.id, parsed);
    }
  };

  const style: React.CSSProperties = {
    gridColumn: `${widget.colStart} / span ${widget.span}`,
    transform: CSS.Transform.toString(transform),
    zIndex: isDragging ? 80 : isEditing ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(widget.id)}
      className={clsx(
        'relative group flex h-full min-w-0 items-center transition-shadow',
        isDragging && 'opacity-80 shadow-xl',
      )}
    >
      <div
        className={clsx(
          'flex h-full w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md text-[11px] text-slate-700',
          widget.styles?.bgColor ?? 'bg-white',
          borderClass,
          widget.styles?.isBold && '[&_*]:!font-black',
          padding === 'none' && 'px-0 py-0',
          padding === 'small' && 'px-1.5 py-1',
          padding === 'medium' && 'px-2.5 py-1',
          padding === 'large' && 'px-4 py-1',
          isEditing && 'ring-1 ring-sky-200',
          isEditing && isSelected && 'ring-2 ring-sky-500',
        )}
      >
        {isEditing ? (
          <button
            {...attributes}
            {...listeners}
            className="no-drag shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 active:cursor-grabbing"
            title="Drag widget"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {Component ? (
          <div className="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
            <Component
              showBorder={false}
              showBackground={false}
            />
          </div>
        ) : (
          <span className="min-w-0 truncate tracking-normal">{widget.label}</span>
        )}
      </div>

      {isEditing && isSelected && !isDragging ? (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 flex -translate-x-1/2 justify-center">
          <div
            className="no-drag flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center overflow-hidden rounded border border-slate-200 bg-slate-50">
              <button
                onClick={() => onMove(widget.id, widget.colStart - 1)}
                className="p-1 text-slate-500 hover:bg-white hover:text-sky-700"
                title="Move left one cell"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex h-7 items-center border-x border-slate-200 bg-white px-1.5">
                <span className="mr-1 text-[10px] font-bold text-slate-400">W</span>
                <input
                  type="text"
                  value={editSpan}
                  onChange={(event) => handleSpanInput(event.target.value)}
                  onBlur={() => setEditSpan(String(widget.span))}
                  className="h-6 w-7 bg-transparent text-center font-mono text-xs font-bold outline-none"
                />
              </div>
              <button
                onClick={() => onMove(widget.id, widget.colStart + 1)}
                className="p-1 text-slate-500 hover:bg-white hover:text-sky-700"
                title="Move right one cell"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="ml-1 flex items-center">
              <button
                onClick={() => onStyleChange(widget.id, { isBold: !widget.styles?.isBold })}
                className={clsx(
                  'rounded p-1 hover:bg-slate-100',
                  widget.styles?.isBold ? 'text-sky-700' : 'text-slate-400',
                )}
                title="Toggle bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsBorderPanelOpen((value) => !value)}
                className={clsx(
                  'rounded p-1 hover:bg-slate-100',
                  widget.styles?.hasBorder ? 'text-sky-700' : 'text-slate-400',
                )}
                title="Choose border"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
              {isBorderPanelOpen ? (
                <div className="absolute left-1/2 top-[calc(100%+6px)] z-[70] flex -translate-x-1/2 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                  {PRECISION_BORDER_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => {
                        onStyleChange(widget.id, {
                          hasBorder: option.value !== 'none',
                          borderVariant: option.value,
                        });
                        setIsBorderPanelOpen(false);
                      }}
                      className={clsx(
                        'flex w-24 items-center justify-between rounded px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50',
                        (widget.styles?.borderVariant ?? 'medium') === option.value && 'bg-sky-50 text-sky-700',
                      )}
                      title={option.label}
                    >
                      <span>{option.label}</span>
                      <span
                        className={clsx(
                          'h-3 w-5 rounded bg-white',
                          option.value === 'none'
                            ? 'border-0'
                            : getBorderClassForWidget(widget.styles?.bgColor, option.value),
                        )}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                onClick={() => setIsBgPanelOpen((value) => !value)}
                className={clsx(
                  'rounded p-1 hover:bg-slate-100',
                  widget.styles?.bgColor && widget.styles.bgColor !== 'bg-transparent'
                    ? 'text-sky-700'
                    : 'text-slate-400',
                )}
                title="Choose background"
              >
                <PaintBucket className="h-3.5 w-3.5" />
              </button>
              {isBgPanelOpen ? (
                <div className="absolute left-1/2 top-[calc(100%+6px)] z-[70] grid -translate-x-1/2 grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                  {PRECISION_BG_OPTIONS.map((option) => (
                    <button
                      key={option.className}
                      onClick={() => {
                        onStyleChange(widget.id, { bgColor: option.className });
                        setIsBgPanelOpen(false);
                      }}
                      className={clsx(
                        'h-5 w-5 rounded border border-slate-200 ring-offset-1 hover:ring-2 hover:ring-sky-300',
                        option.swatch,
                        option.className === 'bg-transparent' && 'bg-white bg-[linear-gradient(135deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)]',
                        widget.styles?.bgColor === option.className && 'ring-2 ring-sky-500',
                      )}
                      title={option.label}
                    />
                  ))}
                </div>
              ) : null}
              <button
                onClick={() => onRemove(widget.id)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Remove widget"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const PrecisionGridImplementation: React.FC = () => {
  const { widgets: appWidgets } = useWidgetStore();
  const [isEditing, setIsEditing] = useState(true);
  const [widgets, setWidgets] = useState<PrecisionWidgetConfig[]>(() =>
    createPrecisionWidgetsFromAppWidgets(appWidgets),
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedWidgets = useMemo(
    () => [...widgets].sort((a, b) => a.colStart - b.colStart),
    [widgets],
  );

  const moveWidget = (id: string, requestedColStart: number) => {
    setWidgets((current) => current.map((widget) => {
      if (widget.id !== id) return widget;
      const maxStart = PRECISION_MAX_CELLS - widget.span + 1;
      const desired = clamp(requestedColStart, 1, maxStart);
      const openColStart = findFirstAvailableSpace(current, widget.span, desired, id);
      return { ...widget, colStart: openColStart };
    }));
  };

  const resizeWidget = (id: string, requestedSpan: number) => {
    setWidgets((current) => current.map((widget) => {
      if (widget.id !== id) return widget;
      const span = clampSpan(requestedSpan);
      const colStart = findFirstAvailableSpace(current, span, widget.colStart, id);
      return { ...widget, span, colStart };
    }));
  };

  const updateWidgetStyles = (
    id: string,
    styles: Partial<NonNullable<PrecisionWidgetConfig['styles']>>,
  ) => {
    setWidgets((current) => current.map((widget) => (
      widget.id === id
        ? { ...widget, styles: { ...widget.styles, ...styles } }
        : widget
    )));
  };

  const addTemplateWidget = (template: WidgetTemplate) => {
    setWidgets((current) => {
      const span = clampSpan(template.span);
      const colStart = findFirstAvailableSpace(current, span);
      return [
        ...current,
        {
          id: `precision-${template.type}-${Date.now()}`,
          type: template.type,
          label: template.label,
          span,
          colStart,
          styles: { hasBorder: true, bgColor: 'bg-transparent', padding: 'medium' },
        },
      ];
    });
    setSelectedWidgetId(null);
  };

  const removeWidget = (id: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
    setSelectedWidgetId((current) => current === id ? null : current);
  };

  const autoAlign = () => {
    setWidgets((current) => {
      let nextCol = 1;
      return [...current]
        .sort((a, b) => a.colStart - b.colStart)
        .map((widget) => {
          const span = clampSpan(widget.span);
          const nextWidget = {
            ...widget,
            span,
            colStart: clamp(nextCol, 1, PRECISION_MAX_CELLS - span + 1),
          };
          nextCol = nextWidget.colStart + span + 1;
          return nextWidget;
        });
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!containerRef.current) return;
    const activeWidget = widgets.find((widget) => widget.id === event.active.id);
    if (!activeWidget) return;

    const cellWidth = containerRef.current.getBoundingClientRect().width / PRECISION_MAX_CELLS;
    const deltaCells = Math.round(event.delta.x / cellWidth);
    if (deltaCells !== 0) {
      moveWidget(activeWidget.id, activeWidget.colStart + deltaCells);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black uppercase tracking-widest text-sky-700">
            1. 96-Cell Precision Grid / Candidate Replacement
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            Local sandbox state only. Use the edit controls under each widget for exact one-cell moves and typed widths.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="group relative">
            <button
              className={clsx(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black shadow-sm transition-colors',
                isEditing ? 'bg-sky-600 text-white hover:bg-sky-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              <ListChecks className="h-4 w-4" />
              Layout Actions
            </button>
            <div className="invisible absolute right-0 z-[100] mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
              <button
                onClick={() => setIsEditing((value) => !value)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <LayoutTemplate className="h-3.5 w-3.5 text-slate-400" />
                  {isEditing ? 'Done Editing' : 'Edit & Layout'}
                </span>
                <span className={clsx('h-2.5 w-2.5 rounded-full', isEditing ? 'bg-sky-500' : 'bg-slate-200')} />
              </button>
              <button
                onClick={autoAlign}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="h-3.5 w-3.5 text-slate-400" />
                Auto Align
              </button>

              <div className="my-1.5 border-t border-slate-100" />
              <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Add Widget
              </div>
              {WIDGET_TEMPLATES.map((template) => {
                return (
                  <button
                    key={template.type}
                    onClick={() => addTemplateWidget(template)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <Square className="h-3.5 w-3.5 text-slate-400" />
                      {template.label}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{template.span}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-sky-100 bg-white p-4 shadow-sm">
        <header className="flex h-16 w-full items-center rounded-lg border border-slate-300 bg-white pl-1 pr-3 shadow-md">
          <div className="flex h-full shrink-0 items-center justify-center border-r border-slate-100 px-4 text-xs font-bold text-slate-400">
            Left
          </div>
          <div
            ref={containerRef}
            className={clsx(
              'relative mx-2 h-full min-w-[720px] flex-1 overflow-visible',
              isEditing && 'bg-sky-50/40',
            )}
          >
            {isEditing ? (
              <div className="absolute inset-0 grid gap-0.5 opacity-30" style={PRECISION_GRID_STYLE}>
                {Array.from({ length: PRECISION_MAX_CELLS }).map((_, index) => (
                  <div
                    key={index}
                    className={clsx(
                      'h-full border-l border-sky-300',
                      (index + 1) % 8 === 0 && 'border-sky-500',
                    )}
                  />
                ))}
              </div>
            ) : null}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="relative grid h-full items-center gap-0.5 py-1" style={PRECISION_GRID_STYLE}>
                {orderedWidgets.map((widget) => (
                  <PrecisionWidget
                    key={widget.id}
                    widget={widget}
                    isEditing={isEditing}
                    isSelected={selectedWidgetId === widget.id}
                    onSelect={setSelectedWidgetId}
                    onMove={moveWidget}
                    onResize={resizeWidget}
                    onStyleChange={updateWidgetStyles}
                    onRemove={removeWidget}
                  />
                ))}
              </div>
            </DndContext>
          </div>
          <div className="flex h-full shrink-0 items-center justify-center border-l border-slate-100 px-4 text-xs font-bold text-slate-400">
            Right
          </div>
        </header>
      </div>
    </div>
  );
};

// ============================================================================
// IMPLEMENTATION 1: REACT GRID LAYOUT (48 CELLS, SINGLE ROW)
// ============================================================================
const RGLImplementation: React.FC = () => {
  const { t } = useTranslation("common");
  const { widgets, updateWidgetLayouts, isLayoutMode, updateWidgetStyle } = useWidgetStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      if (entries[0]) {
        setWidth(entries[0].contentRect.width);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const visibleWidgets = useMemo(() => widgets.filter((w: any) => w.visible), [widgets]);

  const orderedWidgets = useMemo(() => {
    return [...visibleWidgets].sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0));
  }, [visibleWidgets]);

  const packedLayouts = useMemo(() => {
    const positioned = orderedWidgets.filter((w) => w.layout?.x !== undefined);
    const unpositioned = orderedWidgets.filter((w) => w.layout?.x === undefined);

    const result: { id: string; x: number; w: number }[] = [];

    // Capping max width so one widget doesn't destroy the grid
    for (const w of positioned) {
      let wWidth = (w.layout?.w || 2) * 2; 
      if (wWidth < 2) wWidth = 2;
      if (wWidth > 12) wWidth = 12; // Cap at 12 cells (1/4 of the bar)
      result.push({ id: w.id, x: (w.layout.x || 0) * 2, w: wWidth });
    }

    const maxUsedX = result.reduce((max, item) => Math.max(max, item.x + item.w), 0);
    let nextX = maxUsedX;
    for (const w of unpositioned) {
      let wWidth = (w.layout?.w || 2) * 2;
      if (wWidth < 2) wWidth = 2;
      if (wWidth > 12) wWidth = 12;
      result.push({ id: w.id, x: nextX, w: wWidth });
      nextX += wWidth;
    }

    return result;
  }, [orderedWidgets]);

  const layouts: any[] = useMemo(() => {
    return packedLayouts.map(({ id, x, w: wWidth }) => ({
      i: id,
      x: x,
      y: 0, // Force Y to 0 always
      w: wWidth,
      h: 1, // Force H to 1 always
      minW: 2,
      maxW: 24,
      isResizable: isLayoutMode,
      isDraggable: isLayoutMode,
      resizeHandles: ["e", "w"] as const,
    }));
  }, [packedLayouts, isLayoutMode]);

  const dynamicCols = useMemo(() => {
    const maxNeeded = layouts.reduce((max, l) => Math.max(max, l.x + l.w), 48);
    return maxNeeded;
  }, [layouts]);

  const handleLayoutChange = (newLayout: any) => {
    let hasChanges = false;
    for (const l of newLayout) {
      const current = layouts.find(cl => cl.i === l.i);
      if (!current || current.x !== l.x || current.w !== l.w || current.y !== l.y) {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) return;

    updateWidgetLayouts(
      newLayout.map((l: any) => ({
        i: l.i,
        x: Math.max(0, Math.round(l.x / 2)),
        y: 0,
        w: Math.max(1, Math.round(l.w / 2)),
        h: 1,
      })),
    );
  };

  const rglLayouts = useMemo(() => ({ lg: layouts, md: layouts, sm: layouts, xs: layouts, xxs: layouts }), [layouts]);
  const rglCols = useMemo(() => ({ lg: dynamicCols, md: dynamicCols, sm: dynamicCols, xs: dynamicCols, xxs: dynamicCols }), [dynamicCols]);
  const marginConst = useMemo<[number, number]>(() => [4, 0], []);
  const paddingConst = useMemo<[number, number]>(() => [0, 0], []);

  if (visibleWidgets.length === 0) return <div className="flex-1 min-w-[200px]" />;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={clsx(
        "flex-1 min-h-full relative overflow-visible w-full min-w-[200px] transition-all duration-300",
        isLayoutMode && "bg-[rgba(99,102,241,0.03)] border-x border-[rgba(99,102,241,0.1)]"
      )}
    >
      <ResponsiveGridLayout
        {...({
          className: "layout absolute inset-0 !h-auto min-h-full flex items-center",
          width: width,
          isDraggable: isLayoutMode,
          isResizable: isLayoutMode,
          layouts: rglLayouts,
          onLayoutChange: handleLayoutChange,
          cols: rglCols,
          rowHeight: 36,
          margin: marginConst,
          containerPadding: paddingConst,
          maxRows: 1,
          compactType: "horizontal",
          draggableCancel: ".no-drag",
          preventCollision: false,
        } as any)}
      >
        {visibleWidgets.map((widget: any) => {
          const Component = WidgetMap[widget.type];
          if (!Component) return <div key={widget.id} />;

          return (
            <div
              key={widget.id}
              className={clsx(
                "group relative flex items-center justify-center h-full transition-all",
                isLayoutMode && "bg-white/50 ring-1 ring-indigo-200/50 rounded-md shadow-sm"
              )}
            >
              <div className="flex items-center justify-center w-full h-full p-0.5">
                <Component {...(widget.style || { showBorder: true, showBackground: true })} />
              </div>

              {isLayoutMode && (
                <>
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px] bg-white/10 rounded-lg">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        updateWidgetStyle(widget.id, { showBorder: !widget.style?.showBorder });
                      }}
                      className={clsx(
                        "pointer-events-auto p-1.5 rounded-md bg-white shadow-sm border hover:bg-slate-50 transition-all no-drag",
                        widget.style?.showBorder ? "text-indigo-600 border-indigo-200" : "text-slate-400 border-slate-200"
                      )}
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        updateWidgetStyle(widget.id, { showBackground: !widget.style?.showBackground });
                      }}
                      className={clsx(
                        "pointer-events-auto p-1.5 rounded-md bg-white shadow-sm border hover:bg-slate-50 transition-all no-drag",
                        widget.style?.showBackground ? "text-indigo-600 border-indigo-200" : "text-slate-400 border-slate-200"
                      )}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
};

// ============================================================================
// IMPLEMENTATION 2: DND-KIT (1D HORIZONTAL LIST)
// ============================================================================
const SortableItem = ({ id, widget, isLayoutMode, updateWidgetStyle }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Component = WidgetMap[widget.type];
  if (!Component) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "relative flex items-center justify-center h-full group",
        isLayoutMode && "bg-white/50 ring-1 ring-emerald-200/50 rounded-md shadow-sm px-2"
      )}
    >
      {/* Drag Handle */}
      {isLayoutMode && (
        <div
          {...attributes}
          {...listeners}
          className="mr-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-emerald-500 p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Widget Content */}
      <div className="flex items-center justify-center h-full py-0.5">
        <Component {...(widget.style || { showBorder: true, showBackground: true })} />
      </div>

      {/* Style Controls */}
      {isLayoutMode && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px] bg-white/10 rounded-lg">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateWidgetStyle(widget.id, { showBorder: !widget.style?.showBorder })}
            className={clsx(
              "pointer-events-auto p-1.5 rounded-md bg-white shadow-sm border hover:bg-slate-50 transition-all",
              widget.style?.showBorder ? "text-emerald-600 border-emerald-200" : "text-slate-400 border-slate-200"
            )}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateWidgetStyle(widget.id, { showBackground: !widget.style?.showBackground })}
            className={clsx(
              "pointer-events-auto p-1.5 rounded-md bg-white shadow-sm border hover:bg-slate-50 transition-all",
              widget.style?.showBackground ? "text-emerald-600 border-emerald-200" : "text-slate-400 border-slate-200"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

const DndKitImplementation: React.FC = () => {
  const { widgets, isLayoutMode, updateWidgetStyle } = useWidgetStore();
  const [localWidgets, setLocalWidgets] = useState(() => widgets.filter(w => w.visible));

  // Sync when global widgets change
  useEffect(() => {
    setLocalWidgets(widgets.filter(w => w.visible).sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)));
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts (allows clicks to pass through)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setLocalWidgets((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
        // Note: You would dispatch this new order to your store here if saving.
      });
    }
  };

  if (localWidgets.length === 0) return <div className="flex-1 min-w-[200px]" />;

  return (
    <div className={clsx(
      "flex-1 h-full flex items-center gap-2 overflow-x-auto overflow-y-visible px-2 no-scrollbar",
      isLayoutMode && "bg-[rgba(16,185,129,0.03)] border-x border-[rgba(16,185,129,0.1)]"
    )}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localWidgets.map(w => w.id)}
          strategy={horizontalListSortingStrategy}
        >
          {localWidgets.map((widget) => (
            <SortableItem
              key={widget.id}
              id={widget.id}
              widget={widget}
              isLayoutMode={isLayoutMode}
              updateWidgetStyle={updateWidgetStyle}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};


// ============================================================================
// IMPLEMENTATION 3: CUSTOM 48-CELL GRID DND-KIT
// ============================================================================
const MIN_WIDGET_SPAN = 2;
const MAX_CELLS = 48;

const CustomSortableWidget = ({ widget, isLayoutMode, updateWidgetStyle, onResize }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const span = widget.span || 4; 

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${span}`,
    zIndex: isDragging ? 50 : 1,
  };

  const Component = WidgetMap[widget.type];
  if (!Component) return null;

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startSpan = span;
    const parent = e.currentTarget.parentElement?.parentElement;
    if (!parent) return;
    
    const cellWidth = parent.getBoundingClientRect().width / MAX_CELLS;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const nextSpan = Math.max(MIN_WIDGET_SPAN, Math.min(MAX_CELLS, startSpan + Math.round(deltaX / cellWidth)));
      if (nextSpan !== span) onResize(widget.id, nextSpan);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={clsx(
        "relative group h-full flex items-center bg-white border border-slate-200 rounded-lg shadow-sm transition-opacity",
        isDragging && 'opacity-50 ring-2 ring-blue-500'
      )}
    >
      {isLayoutMode && (
        <div {...attributes} {...listeners} className="w-6 shrink-0 flex items-center justify-center cursor-grab text-slate-400 border-r border-slate-100 h-full bg-slate-50 rounded-l-lg hover:bg-slate-100 hover:text-indigo-500 transition-colors">
          <GripVertical size={14} />
        </div>
      )}
      <div className="flex-1 px-2 flex items-center h-full overflow-hidden">
        <Component {...(widget.style || { showBorder: true, showBackground: true })} />
      </div>

      {isLayoutMode && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px] bg-white/10 rounded-lg">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateWidgetStyle(widget.id, { showBorder: !widget.style?.showBorder })}
            className={clsx(
              "pointer-events-auto p-1.5 rounded-md bg-white shadow-sm border hover:bg-slate-50 transition-all",
              widget.style?.showBorder ? "text-blue-600 border-blue-200" : "text-slate-400 border-slate-200"
            )}
            title="Toggle Border"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateWidgetStyle(widget.id, { showBackground: !widget.style?.showBackground })}
            className={clsx(
              "pointer-events-auto p-1.5 rounded-md bg-white shadow-sm border hover:bg-slate-50 transition-all",
              widget.style?.showBackground ? "text-blue-600 border-blue-200" : "text-slate-400 border-slate-200"
            )}
            title="Toggle Background"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLayoutMode && (
        <div 
          onMouseDown={handleResizeStart} 
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-blue-400/30 opacity-0 group-hover:opacity-100 transition-opacity z-30" 
        />
      )}
    </div>
  );
};

const CustomGridDndImplementation: React.FC = () => {
  const { widgets, isLayoutMode, updateWidgetStyle } = useWidgetStore();
  const [localWidgets, setLocalWidgets] = useState(() => 
    widgets.filter(w => w.visible).sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)).map(w => ({
      ...w,
      span: Math.min(12, Math.max(2, (w.layout?.w || 2) * 2)) 
    }))
  );

  useEffect(() => {
    setLocalWidgets(prev => {
      const visibleIds = new Set(widgets.filter(w => w.visible).map(w => w.id));
      const current = prev.filter(w => visibleIds.has(w.id));
      const currentIds = new Set(current.map(w => w.id));
      const missing = widgets.filter(w => w.visible && !currentIds.has(w.id)).map(w => ({
        ...w,
        span: Math.min(12, Math.max(2, (w.layout?.w || 2) * 2))
      }));
      
      if (missing.length === 0 && current.length === prev.length) {
        return prev;
      }
      
      return [...current, ...missing];
    });
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setLocalWidgets((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleResize = (id: string, newSpan: number) => {
    setLocalWidgets(prev => prev.map(w => w.id === id ? { ...w, span: newSpan } : w));
  };

  if (localWidgets.length === 0) return <div className="flex-1 min-w-[200px]" />;

  return (
    <div className={clsx(
      "flex-1 h-full relative overflow-x-auto overflow-y-visible px-2 no-scrollbar",
      isLayoutMode && "bg-slate-50 border-x border-slate-200"
    )}>
      {isLayoutMode && (
        <div 
          className="absolute inset-x-2 inset-y-0 grid gap-1 pointer-events-none opacity-20"
          style={{ gridTemplateColumns: 'repeat(48, minmax(16px, 1fr))' }}
        >
          {Array.from({ length: 48 }).map((_, i) => <div key={i} className="h-full border-x border-slate-400" />)}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localWidgets.map(w => w.id)} strategy={horizontalListSortingStrategy}>
          <div 
            className="grid gap-1 h-full py-1" 
            style={{ gridTemplateColumns: 'repeat(48, minmax(16px, 1fr))' }}
          >
            {localWidgets.map((widget) => (
              <CustomSortableWidget
                key={widget.id}
                widget={widget}
                isLayoutMode={isLayoutMode}
                updateWidgetStyle={updateWidgetStyle}
                onResize={handleResize}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

// ============================================================================
// CANVAS DEV PAGE
// ============================================================================
export const CanvasDevPage: React.FC = () => {
  const { isLayoutMode, setLayoutMode } = useWidgetStore();
  const [containerHeight, setContainerHeight] = useState('h-12'); // Default TopBar height (48px)
  const [showLegacyImplementations, setShowLegacyImplementations] = useState(false);

  return (
    <div className="p-8 h-full bg-slate-100 overflow-y-auto">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Canvas Dev 🧪</h1>
          <p className="text-slate-500 mb-6">
            Compare all implementations side-by-side. Scroll horizontally if the screen is too small.
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <button 
              onClick={() => setLayoutMode(!isLayoutMode)}
              className={clsx(
                "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all shadow-sm",
                isLayoutMode 
                  ? "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700" 
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <LayoutTemplate className={clsx("w-4 h-4", isLayoutMode && "animate-spin-slow")} />
              {isLayoutMode ? "Disable Layout Mode" : "Enable Layout Mode"}
            </button>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-sm font-medium text-slate-600">Height:</span>
              <select 
                value={containerHeight}
                onChange={e => setContainerHeight(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="h-12">48px (Current TopBar)</option>
                <option value="h-16">64px</option>
              </select>
            </div>

            <button
              onClick={() => setShowLegacyImplementations((value) => !value)}
              className={clsx(
                "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all shadow-sm",
                showLegacyImplementations
                  ? "bg-slate-800 text-white hover:bg-slate-900"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              {showLegacyImplementations ? "Hide Legacy Experiments" : "Show Legacy Experiments"}
            </button>
          </div>
        </div>

        {/* Stacked Implementations */}
        <div className="flex flex-col gap-12 pb-20">
          <PrecisionGridImplementation />

          {!showLegacyImplementations ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-500 shadow-sm">
              Legacy experiments are hidden by default so the 96-cell candidate can be tested without the older shared-store demos causing layout update loops.
            </div>
          ) : (
            <>
          
          {/* Impl 3: Custom Dnd-Kit (48-Cell) */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-black text-blue-600 uppercase tracking-widest pl-2">
              2. Custom Dnd-Kit (48-Cell Grid / Current Prototype)
            </div>
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm relative overflow-visible flex items-center justify-center">
              <header
                className={clsx(
                  containerHeight,
                  "flex items-center justify-between pl-1 pr-3 w-full border border-slate-300 bg-white shadow-md relative overflow-visible rounded-lg"
                )}
              >
                <div className="shrink-0 px-4 text-xs font-bold text-slate-400 border-r border-slate-100 flex items-center justify-center h-full">Left</div>
                <CustomGridDndImplementation />
                <div className="shrink-0 px-4 text-xs font-bold text-slate-400 border-l border-slate-100 flex items-center justify-center h-full">Right</div>
              </header>
            </div>
          </div>

          {/* Impl 2: Pure Dnd-Kit Linear */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-black text-emerald-600 uppercase tracking-widest pl-2">
              3. Pure Dnd-Kit (Linear List / No Grid)
            </div>
            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-300 relative overflow-visible shadow-inner flex items-center justify-center mt-4">
              <header
                className={clsx(
                  containerHeight,
                  "flex items-center justify-between pl-1 pr-3 w-full border border-slate-300 bg-white shadow-md relative overflow-visible rounded-lg mt-2"
                )}
              >
                <div className="shrink-0 px-4 text-xs font-bold text-slate-400 border-r border-slate-100 flex items-center justify-center h-full">Left</div>
                <DndKitImplementation />
                <div className="shrink-0 px-4 text-xs font-bold text-slate-400 border-l border-slate-100 flex items-center justify-center h-full">Right</div>
              </header>
            </div>
          </div>

          {/* Impl 1: React Grid Layout */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-black text-slate-500 uppercase tracking-widest pl-2">
              4. React Grid Layout (48 Cells / Legacy)
            </div>
            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-300 relative overflow-visible shadow-inner flex items-center justify-center mt-4">
              <header
                className={clsx(
                  containerHeight,
                  "flex items-center justify-between pl-1 pr-3 w-full border border-slate-300 bg-white shadow-md relative overflow-visible rounded-lg mt-2"
                )}
              >
                <div className="shrink-0 px-4 text-xs font-bold text-slate-400 border-r border-slate-100 flex items-center justify-center h-full">Left</div>
                <RGLImplementation />
                <div className="shrink-0 px-4 text-xs font-bold text-slate-400 border-l border-slate-100 flex items-center justify-center h-full">Right</div>
              </header>
            </div>
          </div>

            </>
          )}

        </div>

      </div>
    </div>
  );
};
