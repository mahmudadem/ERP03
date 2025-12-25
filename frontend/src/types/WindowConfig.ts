export interface WindowWidget {
  id: string;
  type: 'text' | 'total' | 'status' | 'counter' | 'badge';
  label: string;
  dataSource?: string;
  format?: 'currency' | 'number' | 'date' | 'percentage';
  color?: string;
  icon?: string;
}

export interface WindowAction {
  id: string;
  label: string;
  icon?: string;
  variant: 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
  onClick: string; // Handler function name
  disabled?: boolean;
}

export interface WindowConfig {
  id: string;
  windowType: 'voucher' | 'invoice' | 'report' | 'statement';
  
  header: {
    title: string;
    widgets?: WindowWidget[];
    showControls: boolean;
  };
  
  body: {
    component: string;
    props?: Record<string, any>;
  };
  
  footer: {
    leftWidgets?: WindowWidget[];
    centerWidgets?: WindowWidget[];
    rightWidgets?: WindowWidget[];
    actions: WindowAction[];
  };
}

export const AVAILABLE_WIDGETS: WindowWidget[] = [
  {
    id: 'total-debit',
    type: 'total',
    label: 'Total Debit',
    dataSource: 'voucher.totalDebit',
    format: 'currency',
  },
  {
    id: 'total-credit',
    type: 'total',
    label: 'Total Credit',
    dataSource: 'voucher.totalCredit',
    format: 'currency',
  },
  {
    id: 'subtotal',
    type: 'total',
    label: 'Subtotal',
    dataSource: 'invoice.subtotal',
    format: 'currency',
  },
  {
    id: 'total',
    type: 'total',
    label: 'Total',
    dataSource: 'invoice.total',
    format: 'currency',
  },
  {
    id: 'status',
    type: 'status',
    label: 'Status',
    dataSource: 'document.status',
  },
  {
    id: 'item-count',
    type: 'counter',
    label: 'Items',
    dataSource: 'document.lineCount',
  },
];

export const AVAILABLE_ACTIONS: WindowAction[] = [
  {
    id: 'cancel',
    label: 'Cancel',
    variant: 'text',
    onClick: 'handleClose',
  },
  {
    id: 'save',
    label: 'Save as Draft',
    icon: 'Save',
    variant: 'outline',
    onClick: 'handleSave',
  },
  {
    id: 'submit',
    label: 'Submit for Approval',
    icon: 'Send',
    variant: 'primary',
    onClick: 'handleSubmit',
  },
  {
    id: 'print',
    label: 'Print',
    icon: 'Printer',
    variant: 'outline',
    onClick: 'handlePrint',
  },
  {
    id: 'export',
    label: 'Export',
    icon: 'Download',
    variant: 'outline',
    onClick: 'handleExport',
  },
  {
    id: 'send',
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
      showControls: true,
    },
    body: {
      component: 'GenericVoucherRenderer',
      props: { mode: 'windows' },
    },
    footer: {
      leftWidgets: [
        AVAILABLE_WIDGETS.find(w => w.id === 'total-debit')!,
        AVAILABLE_WIDGETS.find(w => w.id === 'total-credit')!,
      ],
      actions: [
        AVAILABLE_ACTIONS.find(a => a.id === 'cancel')!,
        AVAILABLE_ACTIONS.find(a => a.id === 'save')!,
        AVAILABLE_ACTIONS.find(a => a.id === 'submit')!,
      ],
    },
  },
  invoice: {
    id: 'invoice-config',
    windowType: 'invoice',
    header: {
      title: 'Sales Invoice',
      showControls: true,
    },
    body: {
      component: 'InvoiceRenderer',
    },
    footer: {
      centerWidgets: [
        AVAILABLE_WIDGETS.find(w => w.id === 'subtotal')!,
      ],
      rightWidgets: [
        AVAILABLE_WIDGETS.find(w => w.id === 'total')!,
      ],
      actions: [
        AVAILABLE_ACTIONS.find(a => a.id === 'save')!,
        AVAILABLE_ACTIONS.find(a => a.id === 'send')!,
      ],
    },
  },
  report: {
    id: 'report-config',
    windowType: 'report',
    header: {
      title: 'Report',
      showControls: true,
    },
    body: {
      component: 'ReportRenderer',
    },
    footer: {
      actions: [
        AVAILABLE_ACTIONS.find(a => a.id === 'print')!,
        AVAILABLE_ACTIONS.find(a => a.id === 'export')!,
        AVAILABLE_ACTIONS.find(a => a.id === 'send')!,
      ],
    },
  },
};
