// Comprehensive styling for components
export interface ComponentStyle {
  // Label styling
  labelFontSize?: string;      // e.g., '12px', '14px'
  labelColor?: string;          // e.g., '#333333'
  labelBackground?: string;     // e.g., '#f0f0f0'
  labelFontWeight?: string;     // e.g., 'bold', 'normal'
  
  // Value styling
  valueFontSize?: string;       // e.g., '14px', '16px'
  valueColor?: string;          // e.g., '#000000'
  valueBackground?: string;     // e.g., '#ffffff'
  valueFontWeight?: string;     // e.g., 'bold', 'normal'
  
  // Border/Frame
  borderColor?: string;         // e.g., '#cccccc'
  borderWidth?: string;         // e.g., '1px', '2px'
  borderStyle?: string;         // e.g., 'solid', 'dashed'
  borderRadius?: string;        // e.g., '4px', '8px'
  
  // Sizing
  width?: string;               // e.g., 'auto', '200px'
  height?: string;              // e.g., 'auto', '40px'
  
  // Padding/Spacing
  padding?: string;             // e.g., '8px', '12px'
}

// Unified component type that can be either a widget or an action
export interface WindowComponent {
  id: string;
  type: 'widget' | 'action';
  label: string;
  
  // Grid positioning
  row: number;
  col: number;  // 0-11
  colSpan: number;  // 1-12
  
  // Section assignment (optional, assigned when added to header/footer)
  section?: 'header' | 'footer';
  
  // Widget-specific properties
  widgetType?: 'text' | 'total' | 'status' | 'counter' | 'badge';
  dataSource?: string;
  format?: 'currency' | 'number' | 'date' | 'percentage';
  icon?: string;
  
  // Action-specific properties
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
  onClick?: string;
  disabled?: boolean;
  
  // Comprehensive styling
  style?: ComponentStyle;
}

export interface WindowConfig {
  id: string;
  windowType: 'voucher' | 'invoice' | 'report' | 'statement';
  
  header: {
    title: string;
    components: WindowComponent[];
    showControls: boolean;
  };
  
  body: {
    component: string;
    props?: Record<string, any>;
  };
  
  footer: {
    components: WindowComponent[];
  };
}

// Available widgets for the library
export const AVAILABLE_WIDGETS: Omit<WindowComponent, 'row' | 'col' | 'colSpan'>[] = [
  {
    id: 'total-debit',
    type: 'widget',
    widgetType: 'total',
    label: 'Total Debit',
    dataSource: 'voucher.totalDebit',
    format: 'currency',
  },
  {
    id: 'total-credit',
    type: 'widget',
    widgetType: 'total',
    label: 'Total Credit',
    dataSource: 'voucher.totalCredit',
    format: 'currency',
  },
  {
    id: 'subtotal',
    type: 'widget',
    widgetType: 'total',
    label: 'Subtotal',
    dataSource: 'invoice.subtotal',
    format: 'currency',
  },
  {
    id: 'total',
    type: 'widget',
    widgetType: 'total',
    label: 'Total',
    dataSource: 'invoice.total',
    format: 'currency',
  },
  {
    id: 'status',
    type: 'widget',
    widgetType: 'status',
    label: 'Status',
    dataSource: 'document.status',
  },
  {
    id: 'item-count',
    type: 'widget',
    widgetType: 'counter',
    label: 'Items',
    dataSource: 'document.lineCount',
  },
];

// Available actions for the library
export const AVAILABLE_ACTIONS: Omit<WindowComponent, 'row' | 'col' | 'colSpan'>[] = [
  {
    id: 'cancel',
    type: 'action',
    label: 'Cancel',
    variant: 'text',
    onClick: 'handleClose',
  },
  {
    id: 'save',
    type: 'action',
    label: 'Save as Draft',
    icon: 'Save',
    variant: 'outline',
    onClick: 'handleSave',
  },
  {
    id: 'submit',
    type: 'action',
    label: 'Submit for Approval',
    icon: 'Send',
    variant: 'primary',
    onClick: 'handleSubmit',
  },
  {
    id: 'print',
    type: 'action',
    label: 'Print',
    icon: 'Printer',
    variant: 'outline',
    onClick: 'handlePrint',
  },
  {
    id: 'export',
    type: 'action',
    label: 'Export',
    icon: 'Download',
    variant: 'outline',
    onClick: 'handleExport',
  },
  {
    id: 'send',
    type: 'action',
    label: 'Send',
    icon: 'Mail',
    variant: 'secondary',
    onClick: 'handleSend',
  },
];

// Default configurations
export const DEFAULT_CONFIGS: Record<string, WindowConfig> = {
  voucher: {
    id: 'voucher-config',
    windowType: 'voucher',
    header: {
      title: 'Journal Entry',
      components: [
        {
          ...AVAILABLE_WIDGETS.find(w => w.id === 'status')!,
          row: 0,
          col: 0,
          colSpan: 3,
        } as WindowComponent,
      ],
      showControls: true,
    },
    body: {
      component: 'GenericVoucherRenderer',
      props: { mode: 'windows' },
    },
    footer: {
      components: [
        {
          ...AVAILABLE_WIDGETS.find(w => w.id === 'total-debit')!,
          row: 0,
          col: 0,
          colSpan: 3,
        } as WindowComponent,
        {
          ...AVAILABLE_WIDGETS.find(w => w.id === 'total-credit')!,
          row: 0,
          col: 3,
          colSpan: 3,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'cancel')!,
          row: 0,
          col: 6,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'save')!,
          row: 0,
          col: 8,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'submit')!,
          row: 0,
          col: 10,
          colSpan: 2,
        } as WindowComponent,
      ],
    },
  },
  invoice: {
    id: 'invoice-config',
    windowType: 'invoice',
    header: {
      title: 'Sales Invoice',
      components: [],
      showControls: true,
    },
    body: {
      component: 'InvoiceRenderer',
    },
    footer: {
      components: [
        {
          ...AVAILABLE_WIDGETS.find(w => w.id === 'subtotal')!,
          row: 0,
          col: 4,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_WIDGETS.find(w => w.id === 'total')!,
          row: 0,
          col: 6,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'save')!,
          row: 0,
          col: 8,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'send')!,
          row: 0,
          col: 10,
          colSpan: 2,
        } as WindowComponent,
      ],
    },
  },
  report: {
    id: 'report-config',
    windowType: 'report',
    header: {
      title: 'Report',
      components: [],
      showControls: true,
    },
    body: {
      component: 'ReportRenderer',
    },
    footer: {
      components: [
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'print')!,
          row: 0,
          col: 6,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'export')!,
          row: 0,
          col: 8,
          colSpan: 2,
        } as WindowComponent,
        {
          ...AVAILABLE_ACTIONS.find(a => a.id === 'send')!,
          row: 0,
          col: 10,
          colSpan: 2,
        } as WindowComponent,
      ],
    },
  },
};
