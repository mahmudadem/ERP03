import React, { useMemo, useState, useEffect, useRef } from "react";
import { ResponsiveGridLayout, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { clsx } from "clsx";
import { Square, Layers } from "lucide-react";
import { useWidgetStore } from "../../store/widgetStore";
import { ClockWidget } from "./widgets/ClockWidget";
import { DateWidget } from "./widgets/DateWidget";
import { NotesWidget } from "./widgets/NotesWidget";
import { AlarmWidget } from "./widgets/AlarmWidget";
import { CompanyLogoNameWidget } from "./widgets/CompanyLogoNameWidget";
import { FiscalYearWidget } from "./widgets/FiscalYearWidget";
import { BaseCurrencyWidget } from "./widgets/BaseCurrencyWidget";
import { ApprovalModeWidget } from "./widgets/ApprovalModeWidget";
import { UIModeWidget } from "./widgets/UIModeWidget";
import { useTranslation } from "react-i18next";

const WidgetMap: Record<string, React.FC> = {
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

export const DraggableWidgetSpace: React.FC = () => {
  const { t } = useTranslation("common");
  const { widgets, updateWidgetLayouts, isLayoutMode, updateWidgetStyle } =
    useWidgetStore();

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

  const visibleWidgets = useMemo(
    () => widgets.filter((w: any) => w.visible),
    [widgets],
  );

  // Sort widgets by saved X to maintain consistent order
  const orderedWidgets = useMemo(() => {
    return [...visibleWidgets].sort(
      (a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0),
    );
  }, [visibleWidgets]);

  // Use saved positions when available, only auto-pack widgets without a saved position
  const packedLayouts = useMemo(() => {
    // First, figure out the max X used by widgets that HAVE saved positions
    const positioned = orderedWidgets.filter((w) => w.layout?.x !== undefined);
    const unpositioned = orderedWidgets.filter((w) => w.layout?.x === undefined);

    const result: { id: string; x: number; w: number }[] = [];

    // Keep positioned widgets at their saved X
    for (const w of positioned) {
      let wWidth = w.layout?.w || 2;
      if (wWidth < 1) wWidth = 1;
      result.push({ id: w.id, x: w.layout.x, w: wWidth });
    }

    // Place unpositioned widgets at the end
    const maxUsedX = result.reduce((max, item) => Math.max(max, item.x + item.w), 0);
    let nextX = maxUsedX;
    for (const w of unpositioned) {
      let wWidth = w.layout?.w || 2;
      if (wWidth < 1) wWidth = 1;
      result.push({ id: w.id, x: nextX, w: wWidth });
      nextX += wWidth;
    }

    return result;
  }, [orderedWidgets]);

  const totalCols = useMemo(() => {
    const usedWidth = packedLayouts.reduce((sum, item) => sum + item.w, 0);
    return Math.max(usedWidth, visibleWidgets.length * 2, 20);
  }, [packedLayouts, visibleWidgets]);

  const layouts: any[] = useMemo(() => {
    return packedLayouts.map(({ id, x, w: wWidth }) => ({
      i: id,
      x: x,
      y: 0,
      w: wWidth,
      h: 1,
      minW: 1,
      maxW: 10,
      isResizable: isLayoutMode,
      isDraggable: isLayoutMode,
      resizeHandles: ["e", "w"] as const,
    }));
  }, [packedLayouts, isLayoutMode]);

  const handleLayoutChange = (newLayout: any) => {
    updateWidgetLayouts(
      newLayout.map((l: any) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      })),
    );
  };

  if (visibleWidgets.length === 0)
    return <div className="flex-1 min-w-[200px]" />;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={clsx(
        "flex-1 min-h-full relative overflow-hidden z-10 w-full min-w-[200px] transition-all duration-300",
        isLayoutMode &&
          "topbar-grid-bg bg-[rgba(99,102,241,0.03)] border-x border-[rgba(99,102,241,0.1)]",
      )}
    >
      <ResponsiveGridLayout
        {...({
          className:
            "layout absolute inset-0 !h-auto min-h-full flex items-center",
          width: width,
          isDraggable: isLayoutMode,
          isResizable: isLayoutMode,
          layouts: {
            lg: layouts,
            md: layouts,
            sm: layouts,
            xs: layouts,
            xxs: layouts,
          },
          onLayoutChange: handleLayoutChange,
          cols: {
            lg: totalCols,
            md: totalCols,
            sm: totalCols,
            xs: totalCols,
            xxs: totalCols,
          },
          rowHeight: 36,
          margin: [8, 0],
          containerPadding: [0, 0],
          maxRows: 1,
          compactType: "horizontal",
          draggableCancel: ".no-drag",
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
                isLayoutMode &&
                  "bg-white/50 ring-1 ring-indigo-200/50 rounded-md shadow-sm",
              )}
            >
              <div className="flex items-center justify-center w-full h-full p-0.5">
                <Component
                  {...(widget.style || {
                    showBorder: true,
                    showBackground: true,
                  })}
                />
              </div>

              {isLayoutMode && (
                <>
                  <div className="absolute top-[-14px] left-0 z-50 flex gap-1.5 scale-90 origin-left no-drag">
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        updateWidgetStyle(widget.id, {
                          showBorder: !widget.style?.showBorder,
                        });
                      }}
                      className={clsx(
                        "p-1.5 rounded-md bg-white shadow-xl border border-indigo-200 hover:bg-indigo-50 transition-all no-drag active:scale-95",
                        widget.style?.showBorder
                          ? "text-indigo-600 ring-1 ring-indigo-100"
                          : "text-slate-400",
                      )}
                      title={t("widget.toggleBorder", "Toggle Border")}
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        updateWidgetStyle(widget.id, {
                          showBackground: !widget.style?.showBackground,
                        });
                      }}
                      className={clsx(
                        "p-1.5 rounded-md bg-white shadow-xl border border-indigo-200 hover:bg-indigo-50 transition-all no-drag active:scale-95",
                        widget.style?.showBackground
                          ? "text-indigo-600 ring-1 ring-indigo-100"
                          : "text-slate-400",
                      )}
                      title={t("widget.toggleBackground", "Toggle Background")}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="absolute top-0 bottom-0 right-[-4px] w-2 cursor-ew-resize opacity-100 bg-indigo-500/30 hover:bg-indigo-500 rounded-sm z-20 transition-all flex items-center justify-center react-resizable-handle-e">
                    <div className="h-4 w-1 bg-white/50 rounded-full" />
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
