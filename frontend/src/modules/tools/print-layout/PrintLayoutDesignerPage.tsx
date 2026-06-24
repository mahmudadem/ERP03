import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Box,
  Download,
  FileText,
  Grip,
  Image,
  Italic,
  Plus,
  QrCode,
  Ruler,
  Save,
  Table,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import {
  PrintDataSchema,
  PrintDocumentType,
  PrintLayoutComponent,
  PrintLayoutSchema,
  PrintLayoutTemplateDTO,
  PrintPaperProfile,
  printLayoutApi,
} from '../../../api/printLayoutApi';

const DOCUMENT_TYPES: Array<{ value: PrintDocumentType; label: string }> = [
  { value: 'POS_RECEIPT', label: 'POS Receipt' },
  { value: 'SALES_INVOICE', label: 'Sales Invoice' },
];

const PAPER_PRESETS: Record<string, PrintPaperProfile> = {
  A4: { type: 'A4', width: 210, height: 297, unit: 'mm', marginTop: 12, marginRight: 12, marginBottom: 12, marginLeft: 12, orientation: 'portrait' },
  A5: { type: 'A5', width: 148, height: 210, unit: 'mm', marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10, orientation: 'portrait' },
  RECEIPT_80: { type: 'RECEIPT_80', width: 80, height: 220, unit: 'mm', marginTop: 3, marginRight: 3, marginBottom: 3, marginLeft: 3 },
  RECEIPT_58: { type: 'RECEIPT_58', width: 58, height: 220, unit: 'mm', marginTop: 3, marginRight: 3, marginBottom: 3, marginLeft: 3 },
};

const SAMPLE_VALUES: Record<string, string> = {
  'company.name': 'Demo Trading Co.',
  'company.taxNumber': 'TRN-100200300',
  'receipt.number': 'POS-000124',
  'receipt.date': '2026-06-22',
  'receipt.cashierName': 'Cashier One',
  'receipt.registerName': 'Front Register',
  'invoice.number': 'SI-000342',
  'invoice.date': '2026-06-22',
  'invoice.dueDate': '2026-07-22',
  'customer.name': 'Walk-in Customer',
  'customer.taxNumber': 'CUST-TAX-1',
  'totals.subtotal': '125.00',
  'totals.discountTotal': '5.00',
  'totals.taxTotal': '12.00',
  'totals.grandTotal': '132.00',
  'payments.summary': 'Cash 150.00 / Change 18.00',
};

const SAMPLE_ROWS: Record<string, string>[] = [
  { itemCode: 'A-100', itemName: 'Notebook', description: 'Notebook', qty: '2', unitPrice: '25.00', discount: '0.00', tax: '5.00', lineTotal: '55.00' },
  { itemCode: 'B-200', itemName: 'Pen set', description: 'Pen set', qty: '1', unitPrice: '70.00', discount: '5.00', tax: '7.00', lineTotal: '72.00' },
  { itemCode: 'C-300', itemName: 'USB cable', description: 'USB cable', qty: '3', unitPrice: '8.00', discount: '0.00', tax: '2.40', lineTotal: '26.40' },
  { itemCode: 'D-400', itemName: 'Thermal roll', description: 'Thermal roll', qty: '5', unitPrice: '4.00', discount: '0.00', tax: '2.00', lineTotal: '22.00' },
  { itemCode: 'E-500', itemName: 'Folder', description: 'Folder', qty: '4', unitPrice: '3.50', discount: '1.00', tax: '1.30', lineTotal: '14.30' },
  { itemCode: 'F-600', itemName: 'Marker', description: 'Marker', qty: '2', unitPrice: '6.00', discount: '0.00', tax: '1.20', lineTotal: '13.20' },
  { itemCode: 'G-700', itemName: 'Stapler', description: 'Stapler', qty: '1', unitPrice: '18.00', discount: '0.00', tax: '1.80', lineTotal: '19.80' },
  { itemCode: 'H-800', itemName: 'Tape', description: 'Tape', qty: '2', unitPrice: '5.00', discount: '0.00', tax: '1.00', lineTotal: '11.00' },
  { itemCode: 'I-900', itemName: 'Paper pack', description: 'Paper pack', qty: '1', unitPrice: '45.00', discount: '2.00', tax: '4.30', lineTotal: '47.30' },
  { itemCode: 'J-1000', itemName: 'Envelope', description: 'Envelope', qty: '10', unitPrice: '0.80', discount: '0.00', tax: '0.80', lineTotal: '8.80' },
];

const newId = (type: string) => `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const scaleForPaper = (paper: PrintPaperProfile) => paper.type.startsWith('RECEIPT') ? 4 : 3;

export default function PrintLayoutDesignerPage() {
  const [documentType, setDocumentType] = useState<PrintDocumentType>('POS_RECEIPT');
  const [templates, setTemplates] = useState<PrintLayoutTemplateDTO[]>([]);
  const [schema, setSchema] = useState<PrintDataSchema | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [layout, setLayout] = useState<PrintLayoutSchema>({ version: 1, paper: PAPER_PRESETS.RECEIPT_80, components: [] });
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const selected = layout.components.find((component) => component.id === selectedId) || null;
  const scale = scaleForPaper(layout.paper);

  const load = useCallback(async (type: PrintDocumentType) => {
    setIsLoading(true);
    try {
      const [loadedSchema, list] = await Promise.all([
        printLayoutApi.schema(type),
        printLayoutApi.list(type),
      ]);
      setSchema(loadedSchema);
      const effectiveList = list.length ? list : [await printLayoutApi.createDefault(type)];
      setTemplates(effectiveList);
      const defaultTemplate = effectiveList.find((template) => template.isDefault) || effectiveList[0];
      setSelectedTemplateId(defaultTemplate.id);
      setName(defaultTemplate.name);
      setIsDefault(defaultTemplate.isDefault);
      setLayout(defaultTemplate.layout);
      setSelectedId(defaultTemplate.layout.components[0]?.id || '');
    } catch (error) {
      toast.error('Failed to load print layouts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(documentType);
  }, [documentType, load]);

  const safeBounds = useMemo(() => ({
    left: layout.paper.marginLeft,
    top: layout.paper.marginTop,
    width: layout.paper.width - layout.paper.marginLeft - layout.paper.marginRight,
    height: layout.paper.height - layout.paper.marginTop - layout.paper.marginBottom,
  }), [layout.paper]);

  const updateComponent = (id: string, patch: Partial<PrintLayoutComponent>) => {
    setLayout((current) => ({
      ...current,
      components: current.components.map((component) => component.id === id ? { ...component, ...patch } : component),
    }));
  };

  const addComponent = (type: PrintLayoutComponent['type']) => {
    const tableSchema = schema?.tables[0];
    const component: PrintLayoutComponent = {
      id: newId(type),
      type,
      x: safeBounds.left,
      y: safeBounds.top,
      width: type === 'table' ? safeBounds.width : Math.min(60, safeBounds.width),
      height: type === 'table' ? 45 : 12,
      value: type === 'text' ? 'Text' : undefined,
      fieldPath: type === 'field' ? schema?.fields[0]?.path : undefined,
      tablePath: type === 'table' ? tableSchema?.path : undefined,
      columns: type === 'table' ? tableSchema?.columns.slice(0, 4).map((column, index) => ({
        id: column.path,
        label: column.label,
        fieldPath: column.path,
        width: index === 0 ? 42 : 18,
      })) : undefined,
      tableOptions: type === 'table' ? {
        headerBackgroundColor: '#E4E4E7',
        headerTextColor: '#18181B',
        rowHeight: layout.paper.type.startsWith('RECEIPT') ? 6 : 8,
        overflowMode: 'continue',
        repeatHeaderOnPageBreak: true,
        maxPreviewRows: 12,
      } : undefined,
      style: { fontSize: 10, fontWeight: 'normal', fontStyle: 'normal', color: '#18181B', textAlign: 'left', borderColor: '#D4D4D8', borderWidth: type === 'table' || type === 'box' ? 1 : 0 },
    };
    setLayout((current) => ({ ...current, components: [...current.components, component] }));
    setSelectedId(component.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    setLayout((current) => ({ ...current, components: current.components.filter((component) => component.id !== selected.id) }));
    setSelectedId('');
  };

  const changePaper = (paperType: string) => {
    const nextPaper = PAPER_PRESETS[paperType];
    if (!nextPaper) return;
    setLayout((current) => ({
      ...current,
      paper: nextPaper,
      components: current.components.map((component) => ({
        ...component,
        x: clamp(component.x, 0, Math.max(1, nextPaper.width - component.width)),
        y: clamp(component.y, 0, Math.max(1, nextPaper.height - component.height)),
        width: Math.min(component.width, nextPaper.width),
        height: Math.min(component.height, nextPaper.height),
      })),
    }));
  };

  const handleTemplateChange = (id: string) => {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setName(template.name);
    setIsDefault(template.isDefault);
    setLayout(template.layout);
    setSelectedId(template.layout.components[0]?.id || '');
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const saved = await printLayoutApi.save({ id: selectedTemplateId, name, documentType, layout, isDefault });
      toast.success('Print layout saved');
      const next = templates.some((template) => template.id === saved.id)
        ? templates.map((template) => template.id === saved.id ? saved : { ...template, isDefault: saved.isDefault ? false : template.isDefault })
        : [...templates, saved];
      setTemplates(next);
      setSelectedTemplateId(saved.id);
    } catch (error) {
      toast.error('Failed to save print layout');
    } finally {
      setIsSaving(false);
    }
  };

  const exportLayout = () => {
    const payload = JSON.stringify({ name, documentType, isDefault, layout }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${documentType.toLowerCase()}-print-layout.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Layout exported');
  };

  const importLayout = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.layout || parsed.layout.version !== 1) throw new Error('Invalid layout');
      setName(parsed.name || `${documentType} Imported`);
      setLayout(parsed.layout);
      setSelectedTemplateId('');
      setSelectedId(parsed.layout.components[0]?.id || '');
      toast.success('Layout imported');
    } catch {
      toast.error('Invalid print layout file');
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-600">Loading print designer...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="border-b border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div>
            <h1 className="text-lg font-semibold">Print Layout Designer</h1>
            <p className="text-sm text-zinc-600">Shared company engine for POS, Sales, Purchases, Inventory, and Accounting print layouts.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100" onClick={() => addComponent('text')}><Type size={16} />Text</button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100" onClick={() => addComponent('field')}><FileText size={16} />Field</button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100" onClick={() => addComponent('table')}><Table size={16} />Bill Table</button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100" onClick={() => addComponent('box')}><Box size={16} />Box</button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100" onClick={() => addComponent('qr')}><QrCode size={16} />QR</button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100" onClick={() => addComponent('image')}><Image size={16} />Logo</button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-700 disabled:opacity-60" disabled={isSaving} onClick={save}><Save size={16} />Save</button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-74px)] grid-cols-[280px_minmax(480px,1fr)_320px]">
        <aside className="border-r border-zinc-200 bg-white p-4">
          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Document</label>
          <select className="mb-3 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>

          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Layout</label>
          <select className="mb-3 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm" value={selectedTemplateId} onChange={(event) => handleTemplateChange(event.target.value)}>
            <option value="">Unsaved imported layout</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isDefault ? ' (default)' : ''}</option>)}
          </select>

          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Name</label>
          <input className="mb-3 h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} />

          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Paper</label>
          <select className="mb-3 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm" value={layout.paper.type} onChange={(event) => changePaper(event.target.value)}>
            {Object.keys(PAPER_PRESETS).map((paper) => <option key={paper} value={paper}>{paper.replace('_', ' ')}</option>)}
          </select>

          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
            Default for document type
          </label>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-2 text-sm hover:bg-zinc-100" onClick={exportLayout}><Download size={16} />Export</button>
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-2 text-sm hover:bg-zinc-100" onClick={() => importInputRef.current?.click()}><Upload size={16} />Import</button>
            <input ref={importInputRef} className="hidden" type="file" accept="application/json" onChange={(event) => void importLayout(event.target.files?.[0])} />
          </div>

          <div className="rounded-md border border-zinc-200">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase text-zinc-500">Components</div>
            <div className="max-h-[42vh] overflow-auto">
              {layout.components.map((component) => (
                <button key={component.id} className={`flex w-full items-center gap-2 border-b border-zinc-100 px-3 py-2 text-left text-sm hover:bg-zinc-50 ${selectedId === component.id ? 'bg-zinc-100' : ''}`} onClick={() => setSelectedId(component.id)}>
                  <Grip size={14} /> {component.label || component.value || component.fieldPath || component.tablePath || component.type}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="overflow-auto bg-zinc-100 p-6">
          <div className="mb-3 flex items-center justify-center gap-4 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1"><Ruler size={14} />{layout.paper.width} x {layout.paper.height} {layout.paper.unit}</span>
            <span>Safe area {safeBounds.width} x {safeBounds.height} {layout.paper.unit}</span>
          </div>
          <div
            className="relative mx-auto bg-white shadow-sm"
            style={{ width: layout.paper.width * scale, height: layout.paper.height * scale }}
          >
            <div
              className="pointer-events-none absolute border border-dashed border-rose-400"
              style={{ left: layout.paper.marginLeft * scale, top: layout.paper.marginTop * scale, width: safeBounds.width * scale, height: safeBounds.height * scale }}
            />
            {layout.components.map((component) => (
              <CanvasComponent
                key={component.id}
                component={component}
                selected={component.id === selectedId}
                scale={scale}
                paper={layout.paper}
                onSelect={() => setSelectedId(component.id)}
                onChange={(patch) => updateComponent(component.id, patch)}
              />
            ))}
          </div>
        </main>

        <aside className="border-l border-zinc-200 bg-white p-4">
          <PropertyPanel
            component={selected}
            schema={schema}
            onChange={(patch) => selected && updateComponent(selected.id, patch)}
            onDelete={removeSelected}
          />
        </aside>
      </div>
    </div>
  );
}

function CanvasComponent(props: {
  component: PrintLayoutComponent;
  selected: boolean;
  scale: number;
  paper: PrintPaperProfile;
  onSelect: () => void;
  onChange: (patch: Partial<PrintLayoutComponent>) => void;
}) {
  const { component, selected, scale, paper, onSelect, onChange } = props;
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; original: PrintLayoutComponent } | null>(null);

  const onMouseDown = (event: React.MouseEvent, mode: 'move' | 'resize') => {
    event.stopPropagation();
    onSelect();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, original: component };
    const move = (moveEvent: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const dx = (moveEvent.clientX - state.startX) / scale;
      const dy = (moveEvent.clientY - state.startY) / scale;
      if (state.mode === 'move') {
        onChange({
          x: clamp(state.original.x + dx, 0, paper.width - state.original.width),
          y: clamp(state.original.y + dy, 0, paper.height - state.original.height),
        });
      } else {
        onChange({
          width: clamp(state.original.width + dx, 4, paper.width - state.original.x),
          height: clamp(state.original.height + dy, 4, paper.height - state.original.y),
        });
      }
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const style = component.style || {};
  return (
    <div
      className={`absolute cursor-pointer overflow-hidden ${selected ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-200'}`}
      style={{
        left: component.x * scale,
        top: component.y * scale,
        width: component.width * scale,
        height: component.height * scale,
        color: style.color,
        backgroundColor: style.backgroundColor || (component.type === 'box' ? '#FFFFFF' : 'transparent'),
        borderColor: style.borderColor,
        borderWidth: component.type === 'table' || component.type === 'box' ? (style.borderWidth || 1) : 0,
        fontSize: (style.fontSize || 10) * scale * 0.36,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textAlign: style.textAlign,
      }}
      onMouseDown={(event) => onMouseDown(event, 'move')}
    >
      <ComponentPreview component={component} scale={scale} />
      {selected && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-zinc-900"
          onMouseDown={(event) => onMouseDown(event, 'resize')}
        />
      )}
    </div>
  );
}

function ComponentPreview({ component, scale }: { component: PrintLayoutComponent; scale: number }) {
  if (component.type === 'table') {
    const options = component.tableOptions || {};
    const rowHeight = options.rowHeight || 7;
    const previewRows = SAMPLE_ROWS.slice(0, options.maxPreviewRows || 12);
    const visibleBodyRows = Math.max(1, Math.floor((component.height - rowHeight) / rowHeight));
    const hasOverflow = previewRows.length > visibleBodyRows;
    const rowStyle = { height: rowHeight * scale } as React.CSSProperties;
    return (
      <div className="relative h-full w-full">
        <table className="w-full table-fixed border-collapse text-[inherit]">
          <thead>
            <tr style={rowStyle}>
              {(component.columns || []).map((column) => (
                <th
                  key={column.id}
                  className="border border-zinc-300 px-1 text-left"
                  style={{
                    width: `${column.width}%`,
                    backgroundColor: options.headerBackgroundColor || '#E4E4E7',
                    color: options.headerTextColor || '#18181B',
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index} style={rowStyle}>
                {(component.columns || []).map((column) => <td key={column.id} className="border border-zinc-200 px-1">{row[column.fieldPath] ?? '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {hasOverflow && options.overflowMode === 'continue' && (
          <div className="absolute bottom-0 left-0 right-0 bg-amber-100/95 px-1 py-0.5 text-center text-[10px] font-semibold text-amber-900">
            Continues on next page / receipt length
          </div>
        )}
        {hasOverflow && options.overflowMode === 'clip' && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-100/95 px-1 py-0.5 text-center text-[10px] font-semibold text-red-800">
            Extra rows clipped
          </div>
        )}
      </div>
    );
  }
  if (component.type === 'field') {
    const value = component.fieldPath ? SAMPLE_VALUES[component.fieldPath] || `{${component.fieldPath}}` : 'Field';
    return <div className="p-1">{component.label ? `${component.label}: ` : ''}{value}</div>;
  }
  if (component.type === 'image') return <div className="flex h-full items-center justify-center border border-dashed border-zinc-300 text-zinc-500">Logo</div>;
  if (component.type === 'qr') return <div className="flex h-full items-center justify-center"><QrCode className="h-10 w-10 text-zinc-700" /></div>;
  if (component.type === 'line') return <div className="mt-2 border-t border-zinc-700" />;
  if (component.type === 'box') return null;
  return <div className="p-1">{component.value || 'Text'}</div>;
}

function PropertyPanel(props: {
  component: PrintLayoutComponent | null;
  schema: PrintDataSchema | null;
  onChange: (patch: Partial<PrintLayoutComponent>) => void;
  onDelete: () => void;
}) {
  const { component, schema, onChange, onDelete } = props;
  if (!component) return <div className="text-sm text-zinc-500">Select a component to edit its size, binding, and styling.</div>;
  const style = component.style || {};
  const updateStyle = (patch: Record<string, any>) => onChange({ style: { ...style, ...patch } });
  const tableOptions = component.tableOptions || {};
  const updateTableOptions = (patch: Record<string, any>) => onChange({ tableOptions: { ...tableOptions, ...patch } });
  const tableSchema = schema?.tables.find((table) => table.path === component.tablePath) || schema?.tables[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">{component.type}</h2>
        <button className="inline-flex h-8 items-center gap-2 rounded-md border border-red-200 px-2 text-sm text-red-700 hover:bg-red-50" onClick={onDelete}><Trash2 size={15} />Delete</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key} className="text-xs font-medium text-zinc-600">
            {key.toUpperCase()}
            <input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm" type="number" value={Math.round(component[key] * 10) / 10} onChange={(event) => onChange({ [key]: Number(event.target.value) } as any)} />
          </label>
        ))}
      </div>

      {component.type === 'text' && (
        <label className="block text-xs font-medium text-zinc-600">
          Text
          <textarea className="mt-1 min-h-20 w-full rounded-md border border-zinc-300 p-2 text-sm" value={component.value || ''} onChange={(event) => onChange({ value: event.target.value })} />
        </label>
      )}

      {component.type === 'field' && (
        <label className="block text-xs font-medium text-zinc-600">
          Data field
          <select className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm" value={component.fieldPath || ''} onChange={(event) => onChange({ fieldPath: event.target.value })}>
            {(schema?.fields || []).map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}
          </select>
        </label>
      )}

      {component.type === 'table' && tableSchema && (
        <div>
          <label className="block text-xs font-medium text-zinc-600">
            Table
            <select className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm" value={component.tablePath || tableSchema.path} onChange={(event) => onChange({ tablePath: event.target.value, columns: [] })}>
              {(schema?.tables || []).map((table) => <option key={table.path} value={table.path}>{table.label}</option>)}
            </select>
          </label>
          <div className="mt-3 space-y-2">
            {(component.columns || []).map((column, index) => (
              <div key={column.id} className="grid grid-cols-[1fr_64px_28px] gap-2">
                <input className="h-8 rounded-md border border-zinc-300 px-2 text-xs" value={column.label} onChange={(event) => {
                  const columns = [...(component.columns || [])];
                  columns[index] = { ...column, label: event.target.value };
                  onChange({ columns });
                }} />
                <input className="h-8 rounded-md border border-zinc-300 px-2 text-xs" type="number" value={column.width} onChange={(event) => {
                  const columns = [...(component.columns || [])];
                  columns[index] = { ...column, width: Number(event.target.value) };
                  onChange({ columns });
                }} />
                <button className="rounded-md border border-zinc-300 text-zinc-500 hover:bg-zinc-100" onClick={() => onChange({ columns: (component.columns || []).filter((_, i) => i !== index) })}>x</button>
              </div>
            ))}
            <select className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm" value="" onChange={(event) => {
              const found = tableSchema.columns.find((column) => column.path === event.target.value);
              if (!found) return;
              onChange({ columns: [...(component.columns || []), { id: found.path, label: found.label, fieldPath: found.path, width: 22 }] });
            }}>
              <option value="">Add table column</option>
              {tableSchema.columns.map((column) => <option key={column.path} value={column.path}>{column.label}</option>)}
            </select>
          </div>
          <div className="mt-4 rounded-md border border-zinc-200 p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">Long bill behavior</div>
            <label className="block text-xs font-medium text-zinc-600">
              Overflow
              <select
                className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                value={tableOptions.overflowMode || 'continue'}
                onChange={(event) => updateTableOptions({ overflowMode: event.target.value })}
              >
                <option value="continue">Continue to next page / extend receipt</option>
                <option value="clip">Clip extra rows</option>
                <option value="shrink">Shrink rows to fit frame</option>
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-zinc-600">
                Row height
                <input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm" type="number" min={3} max={40} value={tableOptions.rowHeight || 7} onChange={(event) => updateTableOptions({ rowHeight: Number(event.target.value) })} />
              </label>
              <label className="text-xs font-medium text-zinc-600">
                Preview rows
                <input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm" type="number" min={1} max={200} value={tableOptions.maxPreviewRows || 12} onChange={(event) => updateTableOptions({ maxPreviewRows: Number(event.target.value) })} />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs font-medium text-zinc-600">
              <input type="checkbox" checked={tableOptions.repeatHeaderOnPageBreak !== false} onChange={(event) => updateTableOptions({ repeatHeaderOnPageBreak: event.target.checked })} />
              Repeat table header after page break
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-zinc-600">
                Header bg
                <input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-1" type="color" value={tableOptions.headerBackgroundColor || '#E4E4E7'} onChange={(event) => updateTableOptions({ headerBackgroundColor: event.target.value })} />
              </label>
              <label className="text-xs font-medium text-zinc-600">
                Header text
                <input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-1" type="color" value={tableOptions.headerTextColor || '#18181B'} onChange={(event) => updateTableOptions({ headerTextColor: event.target.value })} />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-zinc-600">Font size<input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm" type="number" value={style.fontSize || 10} onChange={(event) => updateStyle({ fontSize: Number(event.target.value) })} /></label>
        <label className="text-xs font-medium text-zinc-600">Text color<input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-1" type="color" value={style.color || '#18181B'} onChange={(event) => updateStyle({ color: event.target.value })} /></label>
        <label className="text-xs font-medium text-zinc-600">Background<input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-1" type="color" value={style.backgroundColor || '#FFFFFF'} onChange={(event) => updateStyle({ backgroundColor: event.target.value })} /></label>
        <label className="text-xs font-medium text-zinc-600">Border<input className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm" type="number" value={style.borderWidth || 0} onChange={(event) => updateStyle({ borderWidth: Number(event.target.value) })} /></label>
      </div>

      <div className="flex gap-2">
        <button className={`h-8 rounded-md border px-2 ${style.fontWeight === 'bold' ? 'bg-zinc-900 text-white' : 'border-zinc-300'}`} onClick={() => updateStyle({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold size={15} /></button>
        <button className={`h-8 rounded-md border px-2 ${style.fontStyle === 'italic' ? 'bg-zinc-900 text-white' : 'border-zinc-300'}`} onClick={() => updateStyle({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic size={15} /></button>
        {(['left', 'center', 'right'] as const).map((align) => {
          const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
          return <button key={align} className={`h-8 rounded-md border px-2 ${style.textAlign === align ? 'bg-zinc-900 text-white' : 'border-zinc-300'}`} onClick={() => updateStyle({ textAlign: align })}><Icon size={15} /></button>;
        })}
      </div>
    </div>
  );
}
