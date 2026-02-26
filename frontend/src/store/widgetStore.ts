import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetType = 'clock' | 'date' | 'notes' | 'alarm' | 'company-logo' | 'company-info' | 'ui-mode';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  visible: boolean;
}

interface WidgetState {
  widgets: WidgetConfig[];
  setWidgets: (widgets: WidgetConfig[]) => void;
  toggleWidget: (id: string) => void;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      widgets: [
        { id: 'widget-company-logo', type: 'company-logo', visible: true },
        { id: 'widget-company-info', type: 'company-info', visible: true },
        { id: 'widget-ui-mode', type: 'ui-mode', visible: true },
        { id: 'widget-clock', type: 'clock', visible: true },
        { id: 'widget-date', type: 'date', visible: true },
        { id: 'widget-notes', type: 'notes', visible: false },
        { id: 'widget-alarm', type: 'alarm', visible: false },
      ],
      setWidgets: (widgets) => set({ widgets }),
      toggleWidget: (id) => set((state) => ({
        widgets: state.widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
      }))
    }),
    {
      name: 'topbar-widgets',
      merge: (persistedState: any, currentState: WidgetState) => {
        const persistedWidgets = persistedState?.widgets || [];
        // Add any new widgets from the initial state that aren't in the saved state
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
