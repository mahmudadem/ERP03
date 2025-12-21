/**
 * Voucher Wizard - Main Designer Component
 * 
 * ⚠️ THIS IS PURE UI - NO ACCOUNTING LOGIC
 * 
 * This is a multi-step wizard that collects user choices about:
 * - Voucher name, prefix, numbering
 * - Which fields to include
 * - Field layout and ordering  
 * - UI rules and actions
 * 
 * It does NOT:
 * - Know about accounting schemas
 * - Validate accounting rules
 * - Post transactions
 * - Save to database
 * - Transform to canonical format
 * 
 * Output: Plain VoucherTypeConfig object via onSave callback
 */

import React, { useState, useRef } from 'react';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { validateUniqueness } from '../validators/uniquenessValidator';
import { 
  ArrowLeft, ArrowRight, Check, CheckCircle2, 
  LayoutTemplate, Settings, 
  FileText, Shield, Layers, PlayCircle, MousePointerClick, Save,
  GripVertical, X, Sliders
} from 'lucide-react';
import { 
  VoucherTypeConfig, FieldLayout, UIMode, AvailableField, 
  VoucherRule, VoucherAction, SectionLayout, SectionType
} from '../types';
import { GenericVoucherRenderer } from './GenericVoucherRenderer';

// --- MOCK DATA (UI ONLY) ---

const SYSTEM_FIELDS: AvailableField[] = [
  { id: 'voucherNo', label: 'Voucher #', type: 'system', sectionHint: 'HEADER' },
  { id: 'status', label: 'Status', type: 'system', sectionHint: 'HEADER' },
  { id: 'createdBy', label: 'Created By', type: 'system', sectionHint: 'HEADER' },
  { id: 'createdAt', label: 'Created At', type: 'system', sectionHint: 'HEADER' },
];

const AVAILABLE_FIELDS: AvailableField[] = [
  { id: 'date', label: 'Voucher Date', type: 'date', sectionHint: 'HEADER' },
  { id: 'reference', label: 'Reference Doc', type: 'text', sectionHint: 'HEADER' },
  { id: 'description', label: 'Description', type: 'text', sectionHint: 'HEADER' },
  { id: 'currency', label: 'Currency', type: 'select', sectionHint: 'HEADER' },
  { id: 'exchangeRate', label: 'Exchange Rate', type: 'number', sectionHint: 'HEADER' },
  { id: 'paymentMethod', label: 'Payment Method', type: 'select', sectionHint: 'HEADER' },
  { id: 'account', label: 'Account', type: 'text', sectionHint: 'BODY' },
  { id: 'lineItems', label: 'Line Items Table', type: 'table', sectionHint: 'BODY' },
  { id: 'notes', label: 'Internal Notes', type: 'textarea', sectionHint: 'EXTRA' },
  { id: 'attachments', label: 'Attachments', type: 'text', sectionHint: 'EXTRA' },
];

const AVAILABLE_TABLE_COLUMNS = [
    { id: 'account', label: 'Account' },
    { id: 'debit', label: 'Debit' },
    { id: 'credit', label: 'Credit' },
    { id: 'notes', label: 'Notes' },
    { id: 'currency', label: 'Currency' },
    { id: 'category', label: 'Category' },
];

const DEFAULT_RULES: VoucherRule[] = [
  { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Vouchers must be approved by a supervisor.' },
  { id: 'prevent_negative_cash', label: 'Prevent Negative Cash', enabled: false, description: 'Block saving if cash accounts go negative.' },
  { id: 'allow_future_date', label: 'Allow Future Posting Dates', enabled: true, description: 'Users can select dates in the future.' },
  { id: 'mandatory_attachments', label: 'Mandatory Attachments', enabled: false, description: 'Require at least one file upload.' },
];

const DEFAULT_ACTIONS: VoucherAction[] = [
  { type: 'print', label: 'Print Voucher', enabled: true },
  { type: 'email', label: 'Email PDF', enabled: true },
  { type: 'download_pdf', label: 'Download PDF', enabled: true },
  { type: 'download_excel', label: 'Download Excel', enabled: false },
  { type: 'import_csv', label: 'Import Lines (CSV)', enabled: true },
  { type: 'export_json', label: 'Export JSON', enabled: false },
];

// Template definitions (factory presets)
interface VoucherTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBlank: boolean;
  config: Partial<VoucherTypeConfig>;
}

const STEPS = [
  { id: 1, title: 'Template', icon: LayoutTemplate },
  { id: 2, title: 'Basic Info', icon: FileText },
  { id: 3, title: 'Rules', icon: Shield },
  { id: 4, title: 'Fields', icon: Layers },
  { id: 5, title: 'Actions', icon: MousePointerClick },
  { id: 6, title: 'Visual Editor', icon: Settings },
  { id: 7, title: 'Review', icon: CheckCircle2 },
];

interface VoucherDesignerProps {
  initialConfig?: VoucherTypeConfig | null;
  availableTemplates?: VoucherTypeConfig[]; // Templates from database
  onSave?: (config: VoucherTypeConfig) => void;
  onCancel?: () => void;
}

export const VoucherDesigner: React.FC<VoucherDesignerProps> = ({ 
  initialConfig, 
  availableTemplates = [],
  onSave, 
  onCancel 
}) => {
  const { companyId } = useCompanyAccess();
  
  // Wizard State
  // Skip Step 1 (template selection) if editing existing voucher
  const [currentStep, setCurrentStep] = useState(initialConfig ? 2 : 1);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(['date', 'description', 'lineItems']);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // Uniqueness Validation State
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    id?: string;
    prefix?: string;
  }>({});
  const [isValidating, setIsValidating] = useState(false);
  
  // Config State
  const [config, setConfig] = useState<VoucherTypeConfig>(initialConfig || {
    id: 'new_voucher',
    name: 'New Voucher Type',
    prefix: 'JV-',
    startNumber: 1000,
    rules: DEFAULT_RULES,
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'credit', 'notes'],
    actions: DEFAULT_ACTIONS,
    uiModeOverrides: {
      classic: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } },
      windows: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } }
    }
  });

  const [previewMode, setPreviewMode] = useState<UIMode>('windows');
  
  // UI State
  const [selectedField, setSelectedField] = useState<{ id: string, section: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Check if voucher is read-only (system default or locked)
  const isReadOnly = Boolean(initialConfig?.isLocked || initialConfig?.isSystemDefault);

  // Convert database templates to UI template format
  const templates: VoucherTemplate[] = [
    ...availableTemplates.map((t: VoucherTypeConfig) => ({
      id: t.id,
      name: t.name,
      description: `${t.prefix} - ${t.isMultiLine ? 'Multi-line' : 'Single-line'}`,
      icon: '',
      isBlank: false,
      config: t
    })),
    // Always add blank template option
    {
      id: 'blank',
      name: 'Custom (Blank)',
      description: 'Start from scratch with an empty template',
      icon: '',
      isBlank: true,
      config: {
        id: 'new_voucher',
        name: 'New Voucher Type',
        prefix: 'VCH-',
        startNumber: 1000,
        isMultiLine: false,
        rules: DEFAULT_RULES,
        actions: DEFAULT_ACTIONS,
        tableColumns: [],
        uiModeOverrides: {
          classic: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } },
          windows: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } }
        }
      } as VoucherTypeConfig
    }
  ];

  // Resize State
  const resizingRef = useRef<{ section: string, fieldId: string, startX: number, startSpan: number, containerWidth: number } | null>(null);
  
  // --- AUTO-PLACEMENT ALGORITHM ---

  const runAutoPlacement = () => {
    const modes: UIMode[] = ['windows', 'classic'];
    const newOverrides = { ...config.uiModeOverrides };

    modes.forEach(mode => {
      const isWindows = mode === 'windows';
      const sections = {
        HEADER: [] as FieldLayout[],
        BODY: [] as FieldLayout[],
        EXTRA: [] as FieldLayout[],
        ACTIONS: [] as FieldLayout[]
      };

      let headerRow = 0;
      let headerColCursor = 0;

      // 1. Place System Fields
      SYSTEM_FIELDS.forEach((field, idx) => {
        if (isWindows) {
          sections.HEADER.push({ fieldId: field.id, row: 0, col: idx * 3, colSpan: 3 });
        } else {
          sections.HEADER.push({ fieldId: field.id, row: idx, col: 0, colSpan: 12 });
          headerRow++;
        }
      });
      if (isWindows) headerRow = 1;

      // 2. Place User Selected Fields
      const activeFields = AVAILABLE_FIELDS.filter(f => selectedFieldIds.includes(f.id));
      activeFields.forEach(field => {
        if (field.sectionHint === 'HEADER') {
          const span = isWindows ? 4 : 12;
          if (isWindows) {
            if (headerColCursor + span > 12) {
              headerRow++;
              headerColCursor = 0;
            }
            sections.HEADER.push({ fieldId: field.id, row: headerRow, col: headerColCursor, colSpan: span });
            headerColCursor += span;
          } else {
             sections.HEADER.push({ fieldId: field.id, row: headerRow, col: 0, colSpan: 12 });
             headerRow++;
          }
        } 
        else if (field.sectionHint === 'BODY') {
          sections.BODY.push({ fieldId: field.id, row: 0, col: 0, colSpan: 12 });
        }
        else if (field.sectionHint === 'EXTRA') {
          sections.EXTRA.push({ fieldId: field.id, row: sections.EXTRA.length, col: 0, colSpan: 12 });
        }
      });

      // 3. Place Actions
      const enabledActions = config.actions.filter(a => a.enabled);
      enabledActions.forEach((action, idx) => {
          const span = isWindows ? Math.floor(12 / Math.min(4, enabledActions.length)) : 12;
          const row = isWindows ? 0 : idx;
          const col = isWindows ? idx * span : 0;
          sections.ACTIONS.push({ fieldId: `action_${action.type}`, row, col, colSpan: span });
      });

      newOverrides[mode] = {
        sections: {
          HEADER: { order: 0, fields: sections.HEADER },
          BODY: { order: 1, fields: sections.BODY },
          EXTRA: { order: 2, fields: sections.EXTRA },
          ACTIONS: { order: 3, fields: sections.ACTIONS }
        }
      };
    });

    setConfig(prev => ({ ...prev, uiModeOverrides: newOverrides }));
  };

  // --- HANDLERS ---

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t: VoucherTemplate) => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    
    // Apply template configuration
    setConfig(prev => ({
      ...prev,
      ...template.config,
      id: template.config.id || prev.id,
      startNumber: 1000,
      rules: DEFAULT_RULES,
      actions: DEFAULT_ACTIONS,
      uiModeOverrides: prev.uiModeOverrides, // Keep existing layout structure
    }));
  };

  const handleNext = async () => {
    if (currentStep === 1 && !selectedTemplate) {
      // Must select a template before proceeding
      return;
    }
    
    // Validate uniqueness on Step 2 (Basic Info) before proceeding
    if (currentStep === 2 && companyId) {
      setIsValidating(true);
      
      const result = await validateUniqueness(
        companyId,
        config.name,
        config.id,
        config.prefix,
        initialConfig?.id // Exclude self when editing
      );
      
      setValidationErrors(result.errors);
      setIsValidating(false);
      
      if (!result.isValid) {
        // Show errors - user cannot proceed
        alert(`Please fix the following issues:\n${Object.values(result.errors).filter(Boolean).join('\n')}`);
        return;
      }
    }
    
    if (currentStep === 4) {
      runAutoPlacement(); 
    }
    setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleStepClick = (stepId: number) => {
      setCurrentStep(stepId);
  }

  // --- VISUAL EDITOR LOGIC (Drag & Drop + Resize) ---

  const updateSectionOrder = (sectionKey: string, newOrder: number) => {
    const overrides = { ...config.uiModeOverrides };
    const currentModeSections = overrides[previewMode].sections;
    const targetSectionEntry = Object.entries(currentModeSections).find(([_, v]) => (v as SectionLayout).order === newOrder);
    
    if (targetSectionEntry) {
      const [targetKey, targetVal] = targetSectionEntry;
      (targetVal as SectionLayout).order = (currentModeSections[sectionKey as SectionType] as SectionLayout).order;
      (currentModeSections[sectionKey as SectionType] as SectionLayout).order = newOrder;
      setConfig(prev => ({ ...prev, uiModeOverrides: overrides }));
    }
  };

  const handleDragStartField = (e: React.DragEvent, fieldId: string, section: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('fieldId', fieldId);
    e.dataTransfer.setData('section', section);
    e.dataTransfer.setData('type', 'field');
    setSelectedField({ id: fieldId, section });
  };

  const handleDropField = (e: React.DragEvent, targetSection: string, targetRow: number, targetCol: number) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('type');
    if (type !== 'field') return;

    const fieldId = e.dataTransfer.getData('fieldId');
    const sourceSection = e.dataTransfer.getData('section');

    const overrides = { ...config.uiModeOverrides };
    const modeConfig = overrides[previewMode];

    const sourceFields = modeConfig.sections[sourceSection as SectionType].fields;
    const fieldIndex = sourceFields.findIndex((f: FieldLayout) => f.fieldId === fieldId);
    if (fieldIndex === -1) return;
    const [fieldToMove] = sourceFields.splice(fieldIndex, 1);

    fieldToMove.row = targetRow;
    fieldToMove.col = targetCol;

    const targetFields = modeConfig.sections[targetSection as SectionType].fields;
    targetFields.push(fieldToMove);

    setConfig(prev => ({ ...prev, uiModeOverrides: overrides }));
    setSelectedField({ id: fieldId, section: targetSection });
  };

  // --- RESIZE HANDLERS ---

  const startResize = (e: React.MouseEvent, section: string, fieldId: string, currentSpan: number) => {
    e.preventDefault();
    e.stopPropagation();
    const container = (e.target as HTMLElement).closest('.grid-container') as HTMLElement;
    resizingRef.current = {
      section,
      fieldId,
      startX: e.clientX,
      startSpan: currentSpan,
      containerWidth: container ? container.offsetWidth : 1000
    };
    
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  };

  const onResizeMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { section, fieldId, startX, startSpan, containerWidth } = resizingRef.current;
    
    const colWidth = containerWidth / 12;
    const deltaX = e.clientX - startX;
    const deltaCols = Math.round(deltaX / colWidth);
    
    const newSpan = Math.max(1, Math.min(12, startSpan + deltaCols));
    
    const overrides = { ...config.uiModeOverrides };
    const fields = overrides[previewMode].sections[section as SectionType].fields;
    const field = fields.find((f: FieldLayout) => f.fieldId === fieldId);
    if (field && field.colSpan !== newSpan) {
      field.colSpan = newSpan;
      setConfig(prev => ({ ...prev, uiModeOverrides: overrides }));
    }
  };

  const onResizeEnd = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  };

  // --- PROPERTIES PANEL LOGIC ---
  const updateSelectedField = (key: keyof FieldLayout, value: any) => {
    if (!selectedField) return;
    const overrides = { ...config.uiModeOverrides };
    const fields = overrides[previewMode].sections[selectedField.section as SectionType].fields;
    const field = fields.find((f: FieldLayout) => f.fieldId === selectedField.id);
    if (field) {
      // @ts-ignore
      field[key] = value;
      setConfig(prev => ({ ...prev, uiModeOverrides: overrides }));
    }
  };

  const moveSelectedFieldSection = (newSection: string) => {
     if (!selectedField) return;
     const overrides = { ...config.uiModeOverrides };
     const modeConfig = overrides[previewMode];
     
     const sourceFields = modeConfig.sections[selectedField.section as SectionType].fields;
      const idx = sourceFields.findIndex((f: FieldLayout) => f.fieldId === selectedField.id);
     if (idx === -1) return;
     const [field] = sourceFields.splice(idx, 1);
     
      field.row = modeConfig.sections[newSection as SectionType].fields.length;
      field.col = 0;
      modeConfig.sections[newSection as SectionType].fields.push(field);
     
     setConfig(prev => ({ ...prev, uiModeOverrides: overrides }));
     setSelectedField({ ...selectedField, section: newSection });
  };


  const sortedSections = Object.entries(config.uiModeOverrides[previewMode].sections)
    .sort(([, a], [, b]) => (a as SectionLayout).order - (b as SectionLayout).order);

  // --- RENDERERS ---

  const renderInteractiveGrid = (sectionName: string) => {
    const layout = config.uiModeOverrides[previewMode].sections[sectionName as SectionType];
    if (!layout) return null;

    const maxRow = layout.fields.reduce((max: number, f: FieldLayout) => Math.max(max, f.row), 0) + 1;

    return (
      <div 
        className="mb-6 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all relative group"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDropField(e, sectionName, maxRow, 0)}
      >
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center cursor-move">
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase">{sectionName} SECTION</span>
          </div>
          <div className="flex gap-2">
             <button onClick={() => updateSectionOrder(sectionName, layout.order - 1)} disabled={layout.order === 0}><ArrowLeft size={14} className="rotate-90" /></button>
             <button onClick={() => updateSectionOrder(sectionName, layout.order + 1)} disabled={layout.order === 3}><ArrowRight size={14} className="rotate-90" /></button>
          </div>
        </div>

        <div 
          className="p-4 grid grid-cols-12 gap-2 relative min-h-[100px] grid-container"
          style={{ gridTemplateRows: `repeat(${maxRow + 1}, minmax(3rem, auto))` }}
        >
           {Array.from({ length: (maxRow + 1) * 12 }).map((_, i) => {
              const r = Math.floor(i / 12);
              const c = i % 12;
              return (
                <div 
                   key={`cell-${r}-${c}`}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => handleDropField(e, sectionName, r, c)}
                   className="border border-dashed border-gray-100 rounded h-full w-full absolute z-0 pointer-events-auto"
                   style={{ gridRowStart: r + 1, gridColumnStart: c + 1 }}
                />
              );
           })}

           {layout.fields.map((field: FieldLayout, idx: number) => {
              const meta = [...SYSTEM_FIELDS, ...AVAILABLE_FIELDS].find(f => f.id === field.fieldId) 
                         || (field.fieldId.startsWith('action_') ? { label: config.actions.find(a => `action_${a.type}` === field.fieldId)?.label || 'Action', type: 'button' } : null);
              
              const isSelected = selectedField?.id === field.fieldId;

              return (
                <div 
                  key={field.fieldId}
                  draggable
                  onDragStart={(e) => handleDragStartField(e, field.fieldId, sectionName)}
                  onClick={(e) => { e.stopPropagation(); setSelectedField({ id: field.fieldId, section: sectionName }); }}
                  className={`
                    rounded border p-2 flex flex-col justify-center text-xs relative z-10 select-none shadow-sm group/item transition-all
                    ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 z-20' : ''}
                    ${meta?.type === 'system' ? 'bg-gray-100 border-gray-300 text-gray-500' : ''}
                    ${meta?.type === 'button' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold items-center' : ''}
                    ${!meta?.type || (meta.type !== 'system' && meta.type !== 'button') ? 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400 cursor-move' : ''}
                  `}
                  style={{
                    gridColumnStart: field.col + 1,
                    gridColumnEnd: `span ${field.colSpan}`,
                    gridRowStart: field.row + 1,
                  }}
                >
                  <span className="truncate w-full text-center md:text-start font-medium pointer-events-none">
                    {field.labelOverride || meta?.label || field.fieldId}
                  </span>
                  
                  {/* Resize Handle */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-400/50 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center z-30"
                    onMouseDown={(e) => startResize(e, sectionName, field.fieldId, field.colSpan)}
                  >
                     <div className="w-0.5 h-4 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              );
           })}
        </div>
      </div>
    );
  };

  const renderVisualEditor = () => {
    return (
      <div className="max-w-7xl mx-auto h-full flex gap-6">
         {/* Main Canvas */}
         <div className="flex-1 flex flex-col min-w-0">
             <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-50 z-20 py-2">
                <div>
                   <h2 className="text-lg font-bold text-gray-800">Visual Layout Editor</h2>
                   <p className="text-xs text-gray-500">Drag fields to move. Drag right edge to resize.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setPreviewMode('classic')} className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'classic' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Classic</button>
                    <button onClick={() => setPreviewMode('windows')} className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'windows' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Windows</button>
                  </div>
                  <button onClick={() => setIsTesting(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700">
                    <PlayCircle size={14} /> Test Run
                  </button>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto pr-2 pb-10">
                {sortedSections.map(([key, _]) => renderInteractiveGrid(key))}
             </div>
         </div>

         {/* Properties Panel (Right Sidebar) */}
         <div className="w-72 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col shrink-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
               <h3 className="font-bold text-gray-700 flex items-center gap-2">
                 <Sliders size={16} /> Properties
               </h3>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
               {selectedField ? (
                 <div className="space-y-6">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Field ID</label>
                       <div className="text-sm font-mono bg-gray-100 p-2 rounded text-gray-600">{selectedField.id}</div>
                    </div>
                    
                    <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Custom Label</label>
                       <input 
                         type="text" 
                         value={config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.labelOverride || ''}
                         onChange={(e) => updateSelectedField('labelOverride', e.target.value)}
                         placeholder="Default Label"
                         className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                       />
                    </div>

                    <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Width (Columns)</label>
                       <div className="flex items-center gap-3">
                          <input 
                            type="range" min="1" max="12"
                            value={config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.colSpan || 1}
                            onChange={(e) => updateSelectedField('colSpan', parseInt(e.target.value))}
                            className="flex-1 accent-indigo-600 bg-white"
                          />
                          <span className="text-sm font-bold w-6 text-center text-slate-900">{config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.colSpan}</span>
                       </div>
                       <p className="text-[10px] text-gray-400 mt-1">Grid has 12 columns total.</p>
                    </div>

                    <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Move to Section</label>
                       <select 
                         value={selectedField.section}
                         onChange={(e) => moveSelectedFieldSection(e.target.value)}
                         className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-slate-900"
                       >
                          {Object.keys(config.uiModeOverrides[previewMode].sections).map(k => (
                             <option key={k} value={k}>{k}</option>
                          ))}
                       </select>
                    </div>
                 </div>
               ) : (
                 <div className="text-center text-gray-400 py-10">
                    <MousePointerClick size={40} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a field in the grid to edit its properties.</p>
                 </div>
               )}
            </div>
         </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentStep) {
      case 1: // Template Selection
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a Starting Template</h2>
              <p className="text-gray-600">Select a predefined template or start from scratch</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template: VoucherTemplate) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`
                    p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg
                    ${selectedTemplate === template.id 
                      ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                      : 'border-gray-200 bg-white hover:border-indigo-300'
                    }
                  `}
                >
                  <div className="text-center mb-4">
                    {/* Prefix Badge */}
                    <div className="mb-4 flex justify-center">
                      <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                        <span className="text-lg font-mono font-bold text-gray-700">
                          {template.config.prefix || '---'}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{template.name}</h3>
                    <p className="text-sm text-gray-500">{template.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    {selectedTemplate === template.id ? (
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                        <CheckCircle2 size={16} />
                        Selected
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">Click to select</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {selectedTemplate && (
              <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-800 font-medium">
                  ✓ Template selected! Click "Next" to customize your voucher.
                </p>
              </div>
            )}
          </div>
        );
      case 2: // Basic Info
        return (
          <div className="max-w-xl mx-auto space-y-6">
             <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Voucher Type Name *</span>
                  <input 
                    type="text" 
                    value={config.name} 
                    onChange={e => {
                      setConfig({...config, name: e.target.value});
                      if (validationErrors.name) {
                        setValidationErrors(prev => ({...prev, name: undefined}));
                      }
                    }}
                    className={`mt-1 block w-full rounded-md shadow-sm p-2 border bg-white text-slate-900 ${
                      validationErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.name && (
                    <p className="mt-1 text-sm text-red-600">❌ {validationErrors.name}</p>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">ID Key *</span>
                    <input 
                      type="text" 
                      value={config.id} 
                      onChange={e => {
                        setConfig({...config, id: e.target.value});
                        if (validationErrors.id) {
                          setValidationErrors(prev => ({...prev, id: undefined}));
                        }
                      }}
                      className={`mt-1 block w-full rounded-md shadow-sm p-2 border bg-white text-slate-900 ${
                        validationErrors.id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.id && (
                      <p className="mt-1 text-sm text-red-600">❌ {validationErrors.id}</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Prefix *</span>
                    <input 
                      type="text" 
                      value={config.prefix} 
                      onChange={e => {
                        setConfig({...config, prefix: e.target.value});
                        if (validationErrors.prefix) {
                          setValidationErrors(prev => ({...prev, prefix: undefined}));
                        }
                      }}
                      className={`mt-1 block w-full rounded-md shadow-sm p-2 border bg-white text-slate-900 ${
                        validationErrors.prefix ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.prefix && (
                      <p className="mt-1 text-sm text-red-600">❌ {validationErrors.prefix}</p>
                    )}
                  </label>
                </div>
                
                <div onClick={() => setConfig({...config, isMultiLine: !config.isMultiLine})} className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between ${config.isMultiLine ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}>
                   <div>
                      <h3 className="text-sm font-bold text-gray-900">Multi-Line Journal Entry</h3>
                      <p className="text-xs text-gray-500">Enable line items table for this voucher.</p>
                   </div>
                   <div className={`px-3 py-1 rounded-full text-xs font-bold ${config.isMultiLine ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{config.isMultiLine ? 'ON' : 'OFF'}</div>
                </div>

             </div>
          </div>
        );
      case 3: // Rules
        return (
          <div className="max-w-2xl mx-auto grid gap-4">
            {config.rules.map(rule => (
              <div key={rule.id} onClick={() => setConfig(prev => ({...prev, rules: prev.rules.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r)}))} className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer ${rule.enabled ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${rule.enabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>{rule.enabled && <Check size={14} />}</div>
                <div><h4 className="font-bold text-slate-900">{rule.label}</h4><p className="text-sm text-gray-500">{rule.description}</p></div>
              </div>
            ))}
          </div>
        );
      case 4: // Fields
        return (
          <div className="max-w-4xl mx-auto space-y-8">
             <div>
               <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">General Fields</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AVAILABLE_FIELDS.map(field => (
                     <div key={field.id} onClick={() => setSelectedFieldIds(prev => prev.includes(field.id) ? prev.filter(f => f !== field.id) : [...prev, field.id])} className={`p-3 rounded border flex items-center justify-between cursor-pointer ${selectedFieldIds.includes(field.id) ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border-gray-200'}`}>
                        <div className="flex items-center gap-3"><span className="text-sm font-medium">{field.label}</span></div>
                        {selectedFieldIds.includes(field.id) && <CheckCircle2 size={18} />}
                     </div>
                  ))}
               </div>
             </div>

             {config.isMultiLine && (
               <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Table Columns</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {AVAILABLE_TABLE_COLUMNS.map(col => {
                        const isSelected = config.tableColumns?.includes(col.id);
                        return (
                           <div 
                             key={col.id} 
                             onClick={() => {
                                const current = config.tableColumns || [];
                                const updated = isSelected ? current.filter(c => c !== col.id) : [...current, col.id];
                                setConfig({...config, tableColumns: updated});
                             }}
                             className={`p-2 rounded border text-sm flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-slate-800'}`}
                           >
                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                                {isSelected && <Check size={12} />}
                             </div>
                             {col.label}
                           </div>
                        );
                     })}
                  </div>
               </div>
             )}
          </div>
        );
      case 5: // Actions
        return (
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-4">
             {config.actions.map(action => (
               <div key={action.type} onClick={() => setConfig(prev => ({...prev, actions: prev.actions.map(a => a.type === action.type ? { ...a, enabled: !a.enabled } : a)}))} className={`p-4 rounded-lg border cursor-pointer ${action.enabled ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200'}`}>
                  <h4 className="font-bold text-sm text-slate-900">{action.label}</h4>
                  <p className="text-xs text-gray-500">{action.enabled ? 'Enabled' : 'Disabled'}</p>
               </div>
             ))}
          </div>
        );
      case 6: // Visual Editor
        return renderVisualEditor();
      case 7: // Review
        return (
           <div className="max-w-2xl mx-auto text-center space-y-8">
              <div className="bg-green-50 border border-green-200 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-green-600 mb-4"><CheckCircle2 size={40} /></div>
              <h2 className="text-2xl font-bold text-gray-900">Ready to Save</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-start space-y-4 shadow-sm">
                 <div className="flex justify-between pb-2 border-b"><span className="text-gray-500">Name</span><span className="font-bold text-slate-900">{config.name}</span></div>
                 <div className="flex justify-between pb-2"><span className="text-gray-500">Total Fields</span><span className="font-bold text-slate-900">{selectedFieldIds.length}</span></div>
              </div>
           </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800 relative">
      {/* Test Run Modal */}
      {isTesting && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden border border-gray-800">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <PlayCircle size={20} className="text-green-400" />
                    <h2 className="font-bold">Test Run: {config.name} ({previewMode.toUpperCase()} Mode)</h2>
                 </div>
                 <button onClick={() => setIsTesting(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 p-6">
                 <div className="bg-white shadow-lg rounded-lg border border-gray-200 min-h-full">
                    <GenericVoucherRenderer config={config} mode={previewMode} />
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg"><LayoutTemplate size={20} /></div>
            <div><h1 className="text-lg font-bold text-slate-800 leading-tight">Voucher Wizard</h1></div>
         </div>
         <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
      </div>

      {/* Read-only Warning Banner */}
      {isReadOnly && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="font-semibold">⚠️ Read Only:</span>
            <span className="text-sm">This is a system default voucher. Use the Clone button to create a customizable version.</span>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-200 shrink-0 overflow-x-auto">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const Icon = step.icon;
          return (
            <div 
              key={step.id} 
              onClick={() => handleStepClick(step.id)}
              className="flex flex-col items-center relative z-10 w-20 min-w-[5rem] cursor-pointer group"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400 group-hover:border-indigo-300'}`}>
                {isCompleted ? <Check size={20} /> : <Icon size={20} />}
              </div>
              <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{step.title}</span>
              {idx < STEPS.length - 1 && <div className={`absolute top-5 left-1/2 w-[calc(100%+3rem)] h-0.5 -z-10 ${step.id < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col p-8">
         {renderContent()}
      </div>

      {/* Footer */}
      <div className="h-20 bg-white border-t border-gray-200 px-8 flex items-center justify-between shrink-0">
         <button onClick={handleBack} disabled={currentStep === 1} className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"><ArrowLeft size={18} /> Back</button>
         {currentStep === 7 ? (
            <button 
              onClick={() => onSave?.(config)} 
              disabled={isReadOnly}
              className="flex items-center gap-2 px-8 py-2.5 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save size={18} /> {isReadOnly ? 'Read Only' : 'Save & Close'}
            </button>
         ) : (
            <button 
              onClick={handleNext} 
              disabled={(currentStep === 1 && !selectedTemplate) || isValidating}
              className="flex items-center gap-2 px-8 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Next'} <ArrowRight size={18} />
            </button>
         )}
      </div>
    </div>
  );
};
