import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetType = 'clock' | 'date' | 'notes' | 'alarm' | 'company-logo' | 'fiscal-year' | 'base-currency' | 'approval-mode' | 'ui-mode';

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
  updateWidgetLayouts: (newLayouts: { i: string; x: number; y: number; w: number; h: number }[]) => void;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'widget-company-logo', type: 'company-logo', visible: true, layout: { x: 0, y: 0, w: 3, h: 1, minW: 2 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-fiscal-year', type: 'fiscal-year', visible: true, layout: { x: 3, y: 0, w: 2, h: 1, minW: 1 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-base-currency', type: 'base-currency', visible: true, layout: { x: 5, y: 0, w: 2, h: 1, minW: 1 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-approval-mode', type: 'approval-mode', visible: true, layout: { x: 7, y: 0, w: 2, h: 1, minW: 1 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-ui-mode', type: 'ui-mode', visible: true, layout: { x: 14, y: 0, w: 3, h: 1, minW: 2 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-clock', type: 'clock', visible: true, layout: { x: 17, y: 0, w: 3, h: 1, minW: 2 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-date', type: 'date', visible: true, layout: { x: 11, y: 0, w: 3, h: 1, minW: 2 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-notes', type: 'notes', visible: false, layout: { x: 9, y: 0, w: 2, h: 1, minW: 1 }, style: { showBorder: true, showBackground: true } },
  { id: 'widget-alarm', type: 'alarm', visible: false, layout: { x: 10, y: 0, w: 2, h: 1, minW: 1 }, style: { showBorder: true, showBackground: true } },
];

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      isLayoutMode: false,
      setWidgets: (widgets: WidgetConfig[]) => set({ widgets }),
      toggleWidget: (id: string) => set((state) => ({
        widgets: state.widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
      })),
      setLayoutMode: (isLayoutMode: boolean) => set({ isLayoutMode }),
      updateWidgetStyle: (id: string, style: Partial<WidgetStyle>) => set((state) => ({
        widgets: state.widgets.map(w => w.id === id ? { ...w, style: { ...w.style, ...style } as WidgetStyle } : w)
      })),
      updateWidgetLayouts: (newLayouts: { i: string; x: number; y: number; w: number; h: number }[]) => set((state) => {
        const layoutMap = new Map(newLayouts.map(l => [l.i, l]));
        return {
          widgets: state.widgets.map(w => {
            const nl = layoutMap.get(w.id);
            if (nl) {
              return { ...w, layout: { ...w.layout, x: nl.x, y: nl.y, w: nl.w, h: nl.h } };
            }
            return w;
          })
        };
      })
    }),
    {
      name: 'topbar-widgets-grid',
      merge: (persistedState: any, currentState: WidgetState) => {
        const persistedWidgets = persistedState?.widgets || [];
        const missingWidgets = currentState.widgets.filter(
          (cw) => !persistedWidgets.some((pw: any) => pw.id === cw.id)
        );
        return {
          ...currentState,
          ...persistedState,
          widgets: [...persistedWidgets, ...missingWidgets],
        };
      },
    }
  )
);
