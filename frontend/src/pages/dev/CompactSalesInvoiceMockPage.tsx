import { useMemo, useState } from 'react';
import { ClassicLineItemsTable, ColumnDef } from '../../components/shared/ClassicLineItemsTable';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  Link2,
  Lock,
  PackageCheck,
  Paperclip,
  Printer,
  Save,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';

type SourceMode = 'direct' | 'sales-order' | 'delivery-note';
type WarehouseMode = 'single' | 'per-line';
type CurrencyMode = 'base' | 'foreign';
type AdjustmentEffect = 'discount' | 'addition';
type RailFocus =
  | { kind: 'account'; title: string; code: string; subtitle: string; balance: number; note: string }
  | { kind: 'item'; title: string; code: string; subtitle: string; balance: number; note: string };

interface MockLine {
  sku: string;
  item: string;
  warehouse: string;
  qty: number;
  uom: string;
  price: number;
  discount: number;
  taxRate: number;
}

interface InvoiceAdjustmentLine {
  accountCode: string;
  accountName: string;
  effect: AdjustmentEffect;
  amount: number;
  taxRate: number;
  memo: string;
}

const directLines: MockLine[] = [
  { sku: 'HW-SRV-001', item: 'Server Rack Module', warehouse: 'Main', qty: 1, uom: 'PCS', price: 2100000, discount: 0, taxRate: 5 },
  { sku: 'HW-CAB-002', item: 'Network Cable Cat6', warehouse: 'Main', qty: 15, uom: 'PCS', price: 5000, discount: 0, taxRate: 5 },
  { sku: 'HW-SWI-003', item: '24-Port Switch L3', warehouse: 'Main', qty: 2, uom: 'PCS', price: 450000, discount: 0, taxRate: 5 },
];

const linkedLines: MockLine[] = [
  { sku: 'HW-SRV-001', item: 'Server Rack Module', warehouse: 'Main', qty: 1, uom: 'PCS', price: 2100000, discount: 0, taxRate: 5 },
  { sku: 'HW-CAB-002', item: 'Network Cable Cat6', warehouse: 'North', qty: 12, uom: 'PCS', price: 5000, discount: 0, taxRate: 5 },
  { sku: 'SRV-INS-009', item: 'Installation Service', warehouse: 'Service', qty: 1, uom: 'JOB', price: 180000, discount: 10000, taxRate: 0 },
];

const createEmptyLine = (): MockLine => ({
  sku: '',
  item: '',
  warehouse: 'Main',
  qty: 1,
  uom: 'PCS',
  price: 0,
  discount: 0,
  taxRate: 5,
});

const defaultRailFocus: RailFocus = {
  kind: 'account',
  title: 'AR - Arabian Trade Corp',
  code: '1210-0007',
  subtitle: 'Customer receivable control account',
  balance: 8750000,
  note: 'This is the account affected when the invoice is unpaid.',
};

const initialAdjustments: InvoiceAdjustmentLine[] = [
  {
    accountCode: '4910',
    accountName: 'Discount Allowed',
    effect: 'discount',
    amount: 25000,
    taxRate: 0,
    memo: 'Commercial discount',
  },
  {
    accountCode: '4720',
    accountName: 'Delivery Charges Income',
    effect: 'addition',
    amount: 15000,
    taxRate: 5,
    memo: 'Freight charged to customer',
  },
];

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmt(value: number) {
  return money.format(value);
}

function sourceLabel(mode: SourceMode) {
  if (mode === 'sales-order') return 'Sales Order SO-240091';
  if (mode === 'delivery-note') return 'Delivery Note DN-240074';
  return 'Direct';
}

function sourceHint(mode: SourceMode) {
  if (mode === 'sales-order') return 'Customer and prices are inherited; remaining qty is controlled by source.';
  if (mode === 'delivery-note') return 'Delivered lines drive billing; warehouse is source/line based.';
  return 'New invoices open here by default. Link a source only when needed.';
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Field({
  label,
  value,
  muted,
  locked,
  plain,
}: {
  label: string;
  value: string;
  muted?: boolean;
  locked?: boolean;
  plain?: boolean;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
        {label}
        {locked ? <Lock className="h-3 w-3 text-slate-400" /> : null}
      </span>
      <div
        className={cx(
          'flex h-7 min-w-0 items-center rounded px-2 text-xs font-medium',
          plain
            ? 'border border-transparent bg-transparent px-0 text-slate-900'
            : locked
            ? 'border-slate-200 bg-slate-100 text-slate-600'
            : 'border-slate-300 bg-white text-slate-900',
          !plain && 'border shadow-sm',
          muted && 'font-normal text-slate-500',
        )}
      >
        <span className="truncate">{value}</span>
      </div>
    </label>
  );
}

function CompactCard({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-md border border-slate-200 bg-white', className)}>
      <div className="flex h-8 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3">
        <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-700">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <span className={cx('inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-bold', tones[tone])}>
      {children}
    </span>
  );
}

export default function CompactSalesInvoiceMockPage() {
  const [directRows, setDirectRows] = useState<MockLine[]>(() => [...directLines, createEmptyLine()]);
  const [adjustmentRows, setAdjustmentRows] = useState<InvoiceAdjustmentLine[]>(initialAdjustments);
  const [sourceMode, setSourceMode] = useState<SourceMode>('direct');
  const [warehouseMode, setWarehouseMode] = useState<WarehouseMode>('single');
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('base');
  const [isPosted, setIsPosted] = useState(false);
  const [railFocus, setRailFocus] = useState<RailFocus>(defaultRailFocus);

  const effectiveWarehouseMode: WarehouseMode =
    sourceMode === 'delivery-note' || warehouseMode === 'per-line' ? 'per-line' : 'single';

  const lines = sourceMode === 'direct' ? directRows : linkedLines;
  const documentCurrency = currencyMode === 'foreign' ? 'USD' : 'SYP';
  const baseCurrency = 'SYP';
  const exchangeRate = currencyMode === 'foreign' ? 13000 : 1;
  const showBaseCurrency = documentCurrency !== baseCurrency;

  const meaningfulLines = useMemo(
    () => lines.filter((line) => line.item.trim() || line.sku.trim()),
    [lines],
  );

  const totals = useMemo(() => {
    const lineTotals = meaningfulLines.reduce(
      (acc, line) => {
        const gross = line.qty * line.price;
        const net = gross - line.discount;
        const tax = net * (line.taxRate / 100);
        return {
          subtotal: acc.subtotal + gross,
          discount: acc.discount + line.discount,
          tax: acc.tax + tax,
          total: acc.total + net + tax,
          baseTotal: acc.baseTotal + (net + tax) * exchangeRate,
        };
      },
      { subtotal: 0, discount: 0, tax: 0, total: 0, baseTotal: 0 },
    );

    return adjustmentRows.reduce((acc, row) => {
      const sign = row.effect === 'addition' ? 1 : -1;
      const amount = sign * row.amount;
      const tax = Math.max(amount, 0) * (row.taxRate / 100);
      const totalDelta = amount + tax;
      return {
        ...acc,
        adjustmentDiscount: acc.adjustmentDiscount + (row.effect === 'discount' ? row.amount : 0),
        adjustmentAddition: acc.adjustmentAddition + (row.effect === 'addition' ? row.amount : 0),
        adjustmentTax: acc.adjustmentTax + tax,
        tax: acc.tax + tax,
        total: acc.total + totalDelta,
        baseTotal: acc.baseTotal + totalDelta * exchangeRate,
      };
    }, {
      ...lineTotals,
      adjustmentDiscount: 0,
      adjustmentAddition: 0,
      adjustmentTax: 0,
    });
  }, [adjustmentRows, exchangeRate, meaningfulLines]);

  const lockedBySource = sourceMode !== 'direct';
  const warehouseLocked = sourceMode === 'delivery-note';
  const paidAmount = isPosted ? Math.min(500000, totals.total) : 0;
  const remainingAmount = totals.total - paidAmount;
  const settlementAccount = paidAmount > 0 ? 'Cash on Hand - Main Branch' : 'AR - Arabian Trade Corp';
  const settlementAccountCode = paidAmount > 0 ? '1110-0001' : '1210-0007';

  const focusLine = (line: MockLine) => {
    if (!line.item.trim() && !line.sku.trim()) {
      setRailFocus({
        kind: 'item',
        title: 'New item line',
        code: 'EMPTY',
        subtitle: 'Blank working row',
        balance: 0,
        note: 'Fill the item or SKU and a new blank row will open automatically.',
      });
      return;
    }

    setRailFocus({
      kind: 'item',
      title: line.item,
      code: line.sku,
      subtitle: `${line.uom} item · ${line.warehouse} warehouse`,
      balance: line.qty,
      note: line.uom === 'JOB' ? 'Service line: no inventory valuation movement.' : 'Inventory item: cost and stock checks run before posting.',
    });
  };

  const isMeaningfulLine = (line: MockLine) => Boolean(line.item.trim() || line.sku.trim());

  const setLine = (index: number, patch: Partial<MockLine>) => {
    setDirectRows((prev) => {
      const next = prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line));
      const editedLastRow = index === next.length - 1;
      return editedLastRow && isMeaningfulLine(next[index]) ? [...next, createEmptyLine()] : next;
    });
  };

  const addLine = () => {
    setDirectRows((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (index: number) => {
    setDirectRows((prev) => {
      const next = prev.filter((_, lineIndex) => lineIndex !== index);
      return next.some((line) => !isMeaningfulLine(line)) ? next : [...next, createEmptyLine()];
    });
  };

  const focusAdjustment = (row: InvoiceAdjustmentLine) => {
    setRailFocus({
      kind: 'account',
      title: row.accountName,
      code: row.accountCode,
      subtitle: row.effect === 'addition' ? 'Invoice addition account' : 'Invoice discount contra account',
      balance: row.amount,
      note: row.effect === 'addition'
        ? 'Addition lines increase the invoice total and affected receivable.'
        : 'Discount lines reduce the invoice total through a controlled account.',
    });
  };

  const setAdjustment = (index: number, patch: Partial<InvoiceAdjustmentLine>) => {
    setAdjustmentRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const addAdjustment = () => {
    setAdjustmentRows((prev) => [
      ...prev,
      {
        accountCode: '4790',
        accountName: 'Other Sales Adjustment',
        effect: 'addition',
        amount: 0,
        taxRate: 0,
        memo: 'New adjustment',
      },
    ]);
  };

  const removeAdjustment = (index: number) => {
    setAdjustmentRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const lineColumns = useMemo<ColumnDef<MockLine>[]>(() => {
    const columns: ColumnDef<MockLine>[] = [
      {
        id: 'item',
        label: 'Item',
        kind: 'custom',
        width: '260px',
        render: (row, _index, onChange) => (
          <div
            onMouseEnter={() => focusLine(row)}
            onFocus={() => focusLine(row)}
            className="flex h-9 w-full min-w-0 items-center gap-2 rounded px-2 transition-colors hover:bg-blue-50/50 focus-within:bg-blue-50/50"
          >
            <PackageCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_88px] gap-1">
              <span className="flex min-w-0 items-center gap-1">
                <input
                  value={row.item}
                  disabled={isPosted || sourceMode !== 'direct'}
                  onChange={(event) => onChange({ item: event.target.value })}
                  placeholder="Item name"
                  className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                />
                {(isPosted || sourceMode !== 'direct') ? <Lock className="h-3 w-3 shrink-0 text-slate-400" /> : null}
              </span>
              <input
                value={row.sku}
                disabled={isPosted || sourceMode !== 'direct'}
                onChange={(event) => onChange({ sku: event.target.value })}
                placeholder="SKU"
                className="h-7 min-w-0 border-0 bg-transparent p-0 text-right font-mono text-[10px] text-slate-500 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
              />
            </span>
          </div>
        ),
      },
    ];

    if (effectiveWarehouseMode === 'per-line') {
      columns.push({
        id: 'warehouse',
        label: 'Warehouse',
        kind: 'text',
        width: '130px',
        accessor: (row) => row.warehouse,
        setter: (value) => ({ warehouse: String(value) }),
      });
    }

    columns.push(
      {
        id: 'uom',
        label: 'UOM',
        kind: 'select',
        width: '80px',
        align: 'center',
        accessor: (row) => row.uom,
        setter: (value) => ({ uom: String(value) }),
        options: [
          { value: 'PCS', label: 'PCS' },
          { value: 'JOB', label: 'JOB' },
        ],
      },
      {
        id: 'qty',
        label: 'Qty',
        kind: 'number',
        width: '80px',
        accessor: (row) => row.qty,
        setter: (value) => ({ qty: Number(value) }),
      },
      {
        id: 'price',
        label: 'Price',
        kind: 'number',
        width: '120px',
        accessor: (row) => row.price,
        setter: (value) => ({ price: Number(value) }),
      },
      {
        id: 'discount',
        label: 'Discount',
        kind: 'number',
        width: '110px',
        accessor: (row) => row.discount,
        setter: (value) => ({ discount: Number(value) }),
      },
      {
        id: 'tax',
        label: 'Tax',
        kind: 'select',
        width: '90px',
        align: 'right',
        accessor: (row) => String(row.taxRate),
        setter: (value) => ({ taxRate: Number(value) }),
        options: [
          { value: '0', label: '0%' },
          { value: '5', label: '5%' },
        ],
      },
    );

    if (showBaseCurrency) {
      columns.push({
        id: 'lineBase',
        label: 'Line Base',
        kind: 'computed',
        width: '130px',
        compute: (row) => ((row.qty * row.price - row.discount) * (1 + row.taxRate / 100)) * exchangeRate,
        formatter: (value) => fmt(Number(value)),
      });
    }

    columns.push({
      id: 'lineTotal',
      label: 'Line Total',
      kind: 'computed',
      width: '130px',
      compute: (row) => (row.qty * row.price - row.discount) * (1 + row.taxRate / 100),
      formatter: (value) => fmt(Number(value)),
    });

    return columns;
  }, [effectiveWarehouseMode, exchangeRate, isPosted, showBaseCurrency, sourceMode]);

  const adjustmentColumns = useMemo<ColumnDef<InvoiceAdjustmentLine>[]>(() => {
    const columns: ColumnDef<InvoiceAdjustmentLine>[] = [
      {
        id: 'account',
        label: 'Account',
        kind: 'custom',
        width: '260px',
        render: (row) => (
          <button
            type="button"
            onMouseEnter={() => focusAdjustment(row)}
            onFocus={() => focusAdjustment(row)}
            className="flex h-9 w-full min-w-0 flex-col justify-center rounded px-2 text-left transition-colors hover:bg-blue-50/50 focus:bg-blue-50/50 focus:outline-none"
          >
            <span className="truncate text-xs font-bold text-slate-800">{row.accountName}</span>
            <span className="truncate font-mono text-[10px] text-slate-500">{row.accountCode}</span>
          </button>
        ),
      },
      {
        id: 'effect',
        label: 'Effect',
        kind: 'select',
        width: '110px',
        accessor: (row) => row.effect,
        setter: (value) => ({ effect: value as AdjustmentEffect }),
        options: [
          { value: 'discount', label: 'Discount' },
          { value: 'addition', label: 'Addition' },
        ],
      },
      {
        id: 'amount',
        label: 'Amount',
        kind: 'number',
        width: '120px',
        accessor: (row) => row.amount,
        setter: (value) => ({ amount: Number(value) }),
      },
      {
        id: 'taxRate',
        label: 'Tax',
        kind: 'select',
        width: '80px',
        align: 'right',
        accessor: (row) => String(row.taxRate),
        setter: (value) => ({ taxRate: Number(value) }),
        options: [
          { value: '0', label: '0%' },
          { value: '5', label: '5%' },
        ],
      },
      {
        id: 'memo',
        label: 'Memo',
        kind: 'text',
        width: '180px',
        accessor: (row) => row.memo,
        setter: (value) => ({ memo: String(value) }),
      },
      {
        id: 'signedTotal',
        label: 'Impact',
        kind: 'computed',
        width: '120px',
        compute: (row) => {
          const sign = row.effect === 'addition' ? 1 : -1;
          const amount = sign * row.amount;
          const tax = Math.max(amount, 0) * (row.taxRate / 100);
          return amount + tax;
        },
        formatter: (value) => fmt(Number(value)),
      },
    ];

    if (showBaseCurrency) {
      columns.push({
        id: 'baseImpact',
        label: 'Base Impact',
        kind: 'computed',
        width: '130px',
        compute: (row) => {
          const sign = row.effect === 'addition' ? 1 : -1;
          const amount = sign * row.amount;
          const tax = Math.max(amount, 0) * (row.taxRate / 100);
          return (amount + tax) * exchangeRate;
        },
        formatter: (value) => fmt(Number(value)),
      });
    }

    return columns;
  }, [exchangeRate, showBaseCurrency]);

  return (
    <main className="h-full min-h-0 bg-[#F6F8FB] text-slate-900">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <button
              type="button"
              className="rounded border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4.5 w-4.5 text-blue-600" />
                <h1 className="truncate text-base font-black tracking-wide text-slate-950">Sales Invoice</h1>
                <Pill tone={isPosted ? 'green' : 'amber'}>{isPosted ? 'Posted' : 'Draft'}</Pill>
                <Pill tone={sourceMode === 'direct' ? 'green' : 'blue'}>{sourceLabel(sourceMode)}</Pill>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{sourceHint(sourceMode)}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2.5">
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {(['direct', 'sales-order', 'delivery-note'] as SourceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isPosted}
                  onClick={() => setSourceMode(mode)}
                  className={cx(
                    'h-8 rounded px-3 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    sourceMode === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-950',
                  )}
                >
                  {mode === 'direct' ? 'Direct' : mode === 'sales-order' ? 'From SO' : 'From DN'}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={isPosted}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Link2 className="h-3.5 w-3.5" />
              Link source
            </button>

            <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5" title="Document tools">
              {[
                { label: 'Upload attachment', icon: Paperclip },
                { label: 'Download Excel', icon: Download },
                { label: 'Upload from file', icon: FileSpreadsheet },
                { label: 'Read from image', icon: FileImage },
              ].map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.label}
                    type="button"
                    disabled={isPosted}
                    title={tool.label}
                    className="inline-flex h-8 w-8 items-center justify-center rounded bg-white text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCurrencyMode((prev) => (prev === 'base' ? 'foreign' : 'base'))}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              title="Toggle same-currency versus foreign-currency table treatment"
            >
              {documentCurrency}/{baseCurrency}
            </button>
            <button
              type="button"
              onClick={() => setIsPosted((prev) => !prev)}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" />
              {isPosted ? 'Draft preview' : 'Posted preview'}
            </button>
            <button
              type="button"
              disabled={isPosted}
              className="inline-flex h-9 items-center gap-1.5 rounded bg-emerald-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[minmax(0,1fr)_304px] xl:overflow-hidden">
          <section className="flex min-h-0 flex-col gap-2 xl:overflow-hidden">
            {isPosted ? (
              <div className="grid shrink-0 gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="font-black">Posted document view</span>
                  <span className="truncate text-emerald-700">Inputs become plain values; only legal post-posting actions remain.</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="green">JV-2026-0184</Pill>
                  <Pill tone="slate">Edit policy: controlled</Pill>
                  <Pill tone="blue">Approved by CFO</Pill>
                </div>
              </div>
            ) : null}

            <CompactCard
              title="Document Header"
              action={
                <div className="flex items-center gap-1">
                  <Pill tone="slate">{documentCurrency}</Pill>
                  <Pill tone="green">
                    <ShieldCheck className="h-3 w-3" />
                    Policy OK
                  </Pill>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-4 xl:grid-cols-6">
                <Field label="Invoice No." value={isPosted ? 'SI-2026-0184' : 'SI-DRAFT'} muted={!isPosted} plain={isPosted} />
                <Field label="Customer" value="Arabian Trade Corp" locked={lockedBySource || isPosted} plain={isPosted} />
                <Field label="Invoice Date" value="2026-06-07" locked={isPosted} plain={isPosted} />
                <Field label="Due Date" value="2026-07-07" locked={isPosted} plain={isPosted} />
                <Field label="Currency" value={showBaseCurrency ? `${documentCurrency} @ ${fmt(exchangeRate)}` : baseCurrency} locked={isPosted} plain={isPosted} />
                {effectiveWarehouseMode === 'single' ? (
                  <Field label="Warehouse" value="Main Warehouse" locked={isPosted} plain={isPosted} />
                ) : (
                  <Field label="Warehouse Rule" value={warehouseLocked ? 'Source lines' : 'Per line'} locked={warehouseLocked || isPosted} plain={isPosted} />
                )}
              </div>
            </CompactCard>

            <CompactCard
              title="Source And Controls"
              action={
                <button
                  type="button"
                  className="inline-flex h-6 items-center gap-1 rounded border border-slate-200 px-2 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ChevronDown className="h-3 w-3" />
                  More
                </button>
              }
            >
              <div className="grid grid-cols-1 gap-2 p-2 lg:grid-cols-[1fr_240px]">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Field label="Source" value={sourceLabel(sourceMode)} locked={sourceMode !== 'direct' || isPosted} plain={isPosted} />
                  <Field label="Salesperson" value="Rana Khaled" locked={isPosted} plain={isPosted} />
                  <Field label="Price List" value="Default wholesale" locked={lockedBySource || isPosted} plain={isPosted} />
                  <Field label="Reference" value={sourceMode === 'direct' ? 'Manual entry' : 'Auto linked'} locked={sourceMode !== 'direct' || isPosted} plain={isPosted} />
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">Warehouse placement</span>
                    <Truck className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      disabled={sourceMode === 'delivery-note' || isPosted}
                      onClick={() => setWarehouseMode('single')}
                      className={cx(
                        'h-7 rounded border text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        effectiveWarehouseMode === 'single'
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      Header
                    </button>
                    <button
                      type="button"
                      onClick={() => setWarehouseMode('per-line')}
                      className={cx(
                        'h-7 rounded border text-[10px] font-bold transition-colors',
                        effectiveWarehouseMode === 'per-line'
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      Line
                    </button>
                  </div>
                </div>
              </div>
            </CompactCard>

            <CompactCard
              title="Lines"
              className="flex min-h-0 flex-[1.8] flex-col"
              action={
                <Pill tone="slate">{meaningfulLines.length} billable lines</Pill>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
                <ClassicLineItemsTable<MockLine>
                  rows={lines}
                  columns={lineColumns}
                  disabled={isPosted || sourceMode !== 'direct'}
                  onRowChange={(index, patch) => {
                    if (sourceMode === 'direct') setLine(index, patch);
                  }}
                  onRowRemove={sourceMode === 'direct' && !isPosted ? removeLine : undefined}
                  onRowAdd={sourceMode === 'direct' && !isPosted ? addLine : undefined}
                  addLabel="Add line"
                  minRows={1}
                  className="h-full [&>div:first-child]:max-h-none [&>div:first-child]:h-full"
                />
              </div>
            </CompactCard>

            <CompactCard
              title="Invoice Accounts"
              className="flex min-h-[170px] flex-[1] flex-col"
              action={
                <Pill tone={totals.adjustmentAddition > totals.adjustmentDiscount ? 'green' : 'amber'}>
                  {adjustmentRows.length} accounts
                </Pill>
              }
            >
              <div className="min-h-0 flex-1 p-2">
                <ClassicLineItemsTable<InvoiceAdjustmentLine>
                  rows={adjustmentRows}
                  columns={adjustmentColumns}
                  disabled={isPosted}
                  onRowChange={setAdjustment}
                  onRowRemove={!isPosted ? removeAdjustment : undefined}
                  onRowAdd={!isPosted ? addAdjustment : undefined}
                  addLabel="Add account"
                  minRows={0}
                  emptyMessage="No invoice-level accounts yet."
                  className="h-full [&>div:first-child]:max-h-none [&>div:first-child]:h-full"
                />
              </div>
            </CompactCard>

            <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2">
              <CompactCard title="Attachments">
                <div className="flex items-center gap-2 p-2 text-xs text-slate-600">
                  <Paperclip className="h-4 w-4 text-slate-400" />
                  <span className="font-bold">2 files</span>
                  <span className="text-slate-400">PO approval, delivery image</span>
                </div>
              </CompactCard>
              <CompactCard title="Audit And Warnings">
                <div className="grid gap-1 p-2 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded border border-amber-100 bg-amber-50 px-2 py-1 text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-bold">Credit close to limit</span>
                  </div>
                  <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                    <History className="h-4 w-4 shrink-0" />
                    <span className="font-bold">History available</span>
                  </div>
                </div>
              </CompactCard>
            </div>
          </section>

          <aside className="grid min-h-0 gap-2 xl:grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:overflow-hidden">
            <section className="shrink-0 overflow-visible rounded-md border border-slate-200 bg-white">
              <div className="flex h-8 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3">
                <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-700">Info</h2>
                <Pill tone={railFocus.kind === 'item' ? 'blue' : 'slate'}>{railFocus.kind === 'item' ? 'Item' : 'Account'}</Pill>
              </div>
              <div className="flex h-[calc(100%-2rem)] min-h-0 flex-col gap-2 overflow-auto p-2 text-xs">
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{railFocus.code}</div>
                  <div className="mt-0.5 truncate text-sm font-black text-slate-900">{railFocus.title}</div>
                  <div className="truncate text-[11px] font-semibold text-slate-500">{railFocus.subtitle}</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-slate-100 bg-white px-2 py-1.5">
                    <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                      {railFocus.kind === 'item' ? 'Focus Qty' : 'Current Balance'}
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-black text-slate-800">{fmt(railFocus.balance)}</div>
                  </div>
                  <div className="rounded border border-slate-100 bg-white px-2 py-1.5">
                    <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Status</div>
                    <div className="mt-0.5 text-sm font-black text-emerald-700">Active</div>
                  </div>
                </div>
                <div className="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-[11px] leading-4 text-blue-700">
                  {railFocus.note}
                </div>
              </div>
            </section>

            <section className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="flex h-8 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3">
                <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-700">
                  {isPosted ? 'Document Status' : 'Posting Readiness'}
                </h2>
              </div>
              <div className="h-[calc(100%-2rem)] space-y-1 overflow-auto p-2 text-xs">
                <div className="flex items-center gap-2 rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-bold">{isPosted ? 'Ledger voucher created' : 'Balanced posting preview'}</span>
                </div>
                <div className="flex items-center gap-2 rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-bold">{isPosted ? 'Tax lines posted' : 'Tax account resolved'}</span>
                </div>
                <div className={cx(
                  'flex items-center gap-2 rounded border px-2 py-1.5',
                  isPosted ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-amber-100 bg-amber-50 text-amber-700',
                )}>
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-bold">{isPosted ? 'Credit warning acknowledged' : 'Soft credit warning'}</span>
                </div>
              </div>
            </section>

            <section className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="flex h-8 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3">
                <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-700">Settlement</h2>
                <Pill tone={paidAmount > 0 ? 'green' : 'amber'}>{paidAmount > 0 ? 'Partial' : 'Unpaid'}</Pill>
              </div>
              <div className="h-[calc(100%-2rem)] space-y-1.5 overflow-auto p-2 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                    <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Paid</div>
                    <div className="font-mono text-sm font-black text-emerald-700">{fmt(paidAmount)}</div>
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                    <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Remaining</div>
                    <div className="font-mono text-sm font-black text-slate-800">{fmt(remainingAmount)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onMouseEnter={() => setRailFocus(defaultRailFocus)}
                  onFocus={() => setRailFocus(defaultRailFocus)}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                    {paidAmount > 0 ? 'Contra Account' : 'Affected Account'}
                  </div>
                  <div className="truncate font-bold text-slate-800">{settlementAccount}</div>
                  <div className="font-mono text-[10px] text-slate-500">{settlementAccountCode} · {fmt(paidAmount > 0 ? paidAmount : remainingAmount)}</div>
                </button>
              </div>
            </section>

            <section className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="flex h-8 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3">
                <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-700">Totals</h2>
                <Pill tone="slate">{documentCurrency}</Pill>
              </div>
              <div className="space-y-1 p-2">
                {[
                  ['Subtotal', totals.subtotal],
                  ['Line Discount', -totals.discount],
                  ['Account Additions', totals.adjustmentAddition],
                  ['Account Discounts', -totals.adjustmentDiscount],
                  ['Tax', totals.tax],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
                    <span className="font-bold text-slate-500">{label}</span>
                    <span className="font-mono font-bold">{fmt(value as number)}</span>
                  </div>
                ))}
                <div className="rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-white">
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Grand Total</div>
                  <div className="mt-0.5 text-right font-mono text-xl font-black">{fmt(totals.total)}</div>
                  <div className="text-right text-[10px] font-bold text-slate-400">{documentCurrency}</div>
                  {showBaseCurrency ? (
                    <div className="mt-1 border-t border-white/10 pt-1 text-right text-[10px] font-bold text-slate-300">
                      Base {baseCurrency}: <span className="font-mono">{fmt(totals.baseTotal)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>
        </div>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200 bg-white/95 px-4 py-2.5 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="grid items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
            <div className="hidden min-w-0 items-center gap-2 text-xs lg:flex">
              <span className="font-black text-slate-700">Invoice actions</span>
              <span className="text-slate-400">Totals and settlement stay visible in the right rail.</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
              <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
              {isPosted ? (
                <>
                  <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" />
                    Clone
                  </button>
                  <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded bg-rose-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-rose-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Reverse
                  </button>
                </>
              ) : (
                <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded bg-blue-600 px-5 text-xs font-bold text-white transition-colors hover:bg-blue-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Save And Post
                </button>
              )}
            </div>
            <div aria-hidden="true" className="hidden lg:block" />
          </div>
        </footer>
      </div>
    </main>
  );
}
