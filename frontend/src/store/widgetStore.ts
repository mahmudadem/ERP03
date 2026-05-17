import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WidgetType =
  | "clock"
  | "date"
  | "notes"
  | "alarm"
  | "company-logo"
  | "fiscal-year"
  | "base-currency"
  | "approval-mode"
  | "ui-mode";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
}

export interface WidgetStyle {
  showBorder: boolean;
  showBackground: boolean;
  isBold?: boolean;
  bgColor?: string;
  customBgColor?: string;
  borderVariant?: string;
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: "solid" | "dashed" | "dotted" | "double" | "none";
  borderRadius?: string;
  textColor?: string;
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  opacity?: number;
  padding?: "none" | "small" | "medium" | "large";
  fontSize?: "xs" | "sm" | "base";
  textAlign?: "left" | "center" | "right";
  height?: 1 | 2 | 3;
  hoverEffect?: "none" | "scale" | "shadow" | "glow";
  gradientBg?: string;
  backdropBlur?: boolean;
  clockFormat?: "12h" | "24h";
  showSeconds?: boolean;
  dateFormat?: string;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  visible: boolean;
  layout: WidgetLayout;
  style?: WidgetStyle;
}

interface WidgetState {
  widgets: WidgetConfig[];
  isLayoutMode: boolean;
  setWidgets: (widgets: WidgetConfig[]) => void;
  toggleWidget: (id: string) => void;
  setLayoutMode: (mode: boolean) => void;
  updateWidgetStyle: (id: string, style: Partial<WidgetStyle>) => void;
  updateWidgetLayouts: (
    newLayouts: { i: string; x: number; y: number; w: number; h: number }[],
  ) => void;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: "widget-company-logo",
    type: "company-logo",
    visible: true,
    layout: { x: 0, y: 0, w: 12, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-fiscal-year",
    type: "fiscal-year",
    visible: true,
    layout: { x: 13, y: 0, w: 12, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-base-currency",
    type: "base-currency",
    visible: true,
    layout: { x: 26, y: 0, w: 12, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-approval-mode",
    type: "approval-mode",
    visible: true,
    layout: { x: 39, y: 0, w: 14, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-ui-mode",
    type: "ui-mode",
    visible: true,
    layout: { x: 54, y: 0, w: 14, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-clock",
    type: "clock",
    visible: true,
    layout: { x: 84, y: 0, w: 12, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-date",
    type: "date",
    visible: true,
    layout: { x: 69, y: 0, w: 14, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-notes",
    type: "notes",
    visible: false,
    layout: { x: 69, y: 0, w: 10, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
  {
    id: "widget-alarm",
    type: "alarm",
    visible: false,
    layout: { x: 80, y: 0, w: 10, h: 1, minW: 8 },
    style: { showBorder: true, showBackground: true },
  },
];

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      isLayoutMode: false,
      setWidgets: (widgets: WidgetConfig[]) => set({ widgets }),
      toggleWidget: (id: string) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w,
          ),
        })),
      setLayoutMode: (isLayoutMode: boolean) => set({ isLayoutMode }),
      updateWidgetStyle: (id: string, style: Partial<WidgetStyle>) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id
              ? { ...w, style: { ...w.style, ...style } as WidgetStyle }
              : w,
          ),
        })),
      updateWidgetLayouts: (
        newLayouts: { i: string; x: number; y: number; w: number; h: number }[],
      ) =>
        set((state) => {
          const layoutMap = new Map(newLayouts.map((l) => [l.i, l]));
          return {
            widgets: state.widgets.map((w) => {
              const nl = layoutMap.get(w.id);
              if (nl) {
                return {
                  ...w,
                  layout: { ...w.layout, x: nl.x, y: nl.y, w: nl.w, h: nl.h },
                };
              }
              return w;
            }),
          };
        }),
    }),
    {
      name: "topbar-widgets-precision-grid",
      merge: (persistedState: any, currentState: WidgetState) => {
        const persistedWidgets = persistedState?.widgets || [];
        const missingWidgets = currentState.widgets.filter(
          (cw) => !persistedWidgets.some((pw: any) => pw.id === cw.id),
        );
        return {
          ...currentState,
          ...persistedState,
          widgets: [...persistedWidgets, ...missingWidgets],
        };
      },
    },
  ),
);
