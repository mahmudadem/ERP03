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
 * Output: Plain VoucherFormConfig object via onSave callback
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { validateUniqueness } from '../validators/uniquenessValidator';
import { 
  ArrowLeft, ArrowRight, Check, CheckCircle2, 
  LayoutTemplate, Settings, 
  FileText, Shield, Layers, PlayCircle, MousePointerClick, Save,
  GripVertical, X, Sliders
} from 'lucide-react';
import { 
  VoucherFormConfig, FieldLayout, UIMode, AvailableField, 
  VoucherRule, VoucherAction, SectionLayout, SectionType
} from '../types';
import { GenericVoucherRenderer } from '../../components/shared/GenericVoucherRenderer';
import { errorHandler } from '../../../../services/errorHandler';

// --- MOCK DATA (UI ONLY) ---

export const SYSTEM_FIELDS: AvailableField[] = [
  { id: 'voucherNumber', label: 'Voucher #', type: 'system', sectionHint: 'HEADER' },
  { id: 'status', label: 'Status', type: 'system', sectionHint: 'HEADER' },
  { id: 'createdBy', label: 'Created By', type: 'system', sectionHint: 'HEADER' },
  { id: 'createdAt', label: 'Created At', type: 'system', sectionHint: 'HEADER' },
];

export const AVAILABLE_FIELDS: AvailableField[] = [
  { id: 'date', label: 'Voucher Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
  { id: 'payee', label: 'Payee / Customer', type: 'text', sectionHint: 'HEADER', category: 'shared' },
  { id: 'reference', label: 'Reference Doc', type: 'text', sectionHint: 'HEADER', category: 'shared' },
  { id: 'description', label: 'Description', type: 'text', sectionHint: 'HEADER', category: 'core' },
  { id: 'currency', label: 'Currency', type: 'select', sectionHint: 'HEADER', category: 'core', mandatory: true },
  { id: 'exchangeRate', label: 'Exchange Rate', type: 'number', sectionHint: 'HEADER', category: 'shared', supportedTypes: ['payment_voucher', 'receipt_voucher', 'transfer_voucher'] },
  { id: 'paymentMethod', label: 'Payment Method', type: 'select', sectionHint: 'HEADER', category: 'shared', supportedTypes: ['payment_voucher'] },
  { id: 'branch', label: 'Branch / Dept', type: 'select', sectionHint: 'HEADER', category: 'shared' },
  { id: 'currencyExchange', label: 'Exchange Rate (Smart)', type: 'number', sectionHint: 'HEADER', category: 'shared' },
  { id: 'account', label: 'Account (Header)', type: 'account-selector', sectionHint: 'HEADER', category: 'shared' },
  { id: 'lineItems', label: 'Line Items Table', type: 'table', sectionHint: 'BODY', category: 'core', mandatory: true },
  { id: 'notes', label: 'Internal Notes', type: 'textarea', sectionHint: 'EXTRA', category: 'shared' },
  { id: 'attachments', label: 'Attachments', type: 'text', sectionHint: 'EXTRA', category: 'shared' },
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
  config: Partial<VoucherFormConfig>;
}

const STEPS = [
  { id: 1, title: 'Template', icon: LayoutTemplate, description: 'Choose base' },
  { id: 2, title: 'Basic Info', icon: FileText, description: 'ID & Name' },
  { id: 3, title: 'Rules', icon: Shield, description: 'Logic' },
  { id: 4, title: 'Fields', icon: Layers, description: 'Selection' },
  { id: 5, title: 'Actions', icon: MousePointerClick, description: 'Buttons' },
  { id: 6, title: 'Visual Editor', icon: Settings, description: 'Layout' },
  { id: 7, title: 'Review', icon: CheckCircle2, description: 'Finalize' },
];

interface VoucherDesignerProps {
  initialConfig?: VoucherFormConfig | null;
  availableTemplates?: VoucherFormConfig[]; // Templates from database
  onSave?: (config: VoucherFormConfig) => void;
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
  
  const getCoreFieldIds = (baseType?: string) => {
    return AVAILABLE_FIELDS.filter(f => {
      const isCore = f.category === 'core' || f.mandatory;
      if (!isCore) return false;
      if (f.supportedTypes && baseType && !f.supportedTypes.includes(baseType)) return false;
      if (f.excludedTypes && baseType && f.excludedTypes.includes(baseType)) return false;
      return true;
    }).map(f => f.id);
  };

  const isFieldAllowed = (fieldId: string, baseType?: string) => {
    const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
    if (!field) return true; // System fields or unknown fields allowed by default
    if (field.supportedTypes && baseType && !field.supportedTypes.includes(baseType)) return false;
    if (field.excludedTypes && baseType && field.excludedTypes.includes(baseType)) return false;
    return true;
  };

  // Initialize with all core and required fields by default
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(() => {
    // Start with core/mandatory fields if not provided
    if (initialConfig?.id && initialConfig?.id !== 'new_voucher_form') {
       // Extract unique field IDs from existing sections
       const existingFields = new Set<string>();
       Object.values(initialConfig.uiModeOverrides).forEach(mode => {
         Object.values(mode.sections).forEach(s => s.fields.forEach(f => {
           if (!f.fieldId.startsWith('action_') && isFieldAllowed(f.fieldId, initialConfig.baseType)) {
             existingFields.add(f.fieldId);
           }
         }));
       });
       // Combine with mandatory fields
       const mandatory = getCoreFieldIds(initialConfig.baseType);
       return Array.from(new Set([...Array.from(existingFields), ...mandatory]));
    }
    
    return getCoreFieldIds(initialConfig?.baseType);
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // Uniqueness Validation State
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    id?: string;
    prefix?: string;
  }>({});
  const [isValidating, setIsValidating] = useState(false);
  
  // Config State
  const [config, setConfig] = useState<VoucherFormConfig>(initialConfig || {
    id: 'new_voucher_form',
    name: 'New Voucher Form',
    prefix: 'V-',
    startNumber: 1000,
    rules: DEFAULT_RULES,
    isMultiLine: true,
    tableColumns: [
      { id: 'account', labelOverride: 'Account' },
      { id: 'debit', labelOverride: 'Debit' },
      { id: 'credit', labelOverride: 'Credit' },
      { id: 'notes', labelOverride: 'Notes' }
    ],
    actions: DEFAULT_ACTIONS,
    uiModeOverrides: {
      classic: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } },
      windows: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } }
    }
  });

  const [previewMode, setPreviewMode] = useState<UIMode>('windows');
  
  // UI State
  const [selectedField, setSelectedField] = useState<{ id: string, section: string } | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Check if voucher is read-only (system default or locked)
  const isReadOnly = Boolean(initialConfig?.isLocked || initialConfig?.isSystemDefault);

  // Initialize selectedFieldIds from initialConfig when editing
  useEffect(() => {
    if (initialConfig) {
      // Extract field IDs from various sources in the saved config
      const fieldIds = new Set<string>();
      const configAny = initialConfig as any;
      
      // From headerFields
      if (configAny.headerFields && Array.isArray(configAny.headerFields)) {
        configAny.headerFields.forEach((f: any) => {
          fieldIds.add(f.id || f.fieldId || f);
        });
      }
      
      // From uiModeOverrides sections
      const uiOverrides = (initialConfig as any).uiModeOverrides;
      if (uiOverrides) {
        ['windows', 'classic'].forEach(mode => {
          const sections = uiOverrides[mode]?.sections;
          if (sections) {
            Object.values(sections).forEach((section: any) => {
              if (section?.fields && Array.isArray(section.fields)) {
                section.fields.forEach((f: any) => {
                  const id = f.fieldId || f.id || f;
                  if (isFieldAllowed(id, initialConfig.baseType)) {
                    fieldIds.add(id);
                  }
                });
              }
            });
          }
        });
      }
      
      // Always include required/core fields
      getCoreFieldIds(initialConfig.baseType).forEach(id => {
        fieldIds.add(id);
      });
      
      if (fieldIds.size > 0) {
        setSelectedFieldIds(Array.from(fieldIds));
      }
    }
  }, [initialConfig]);

  // Convert database templates to UI template format
  const templates: VoucherTemplate[] = [
    ...availableTemplates.map((t: VoucherFormConfig) => ({
      id: t.id,
      name: t.name,
      description: `${t.prefix} - ${t.isMultiLine ? 'Multi-line' : 'Single-line'}`,
      icon: '',
      isBlank: false,
      config: t
    }))
  ];

  // Resize State
  const resizingRef = useRef<{ section: string, fieldId: string, startX: number, startSpan: number, containerWidth: number } | null>(null);
  
  // --- AUTO-PLACEMENT ALGORITHM ---

  const  runAutoPlacement = () => {
    const modes: UIMode[] = ['windows', 'classic'];
    const newOverrides = { ...config.uiModeOverrides };

    modes.forEach(mode => {
      const isWindows = mode === 'windows';
      const currentModeConfig = newOverrides[mode];
      
      // 1. Collect all currently assigned field IDs across all sections to identify orphans/deleted
      const assignedFieldIds = new Set<string>();
      Object.values(currentModeConfig.sections).forEach(section => {
        section.fields.forEach(f => assignedFieldIds.add(f.fieldId));
      });

      // 2. Filter out fields that are no longer selected or actions that are no longer enabled
      Object.keys(currentModeConfig.sections).forEach(sectionKey => {
        const section = currentModeConfig.sections[sectionKey as SectionType];
        section.fields = section.fields.filter(f => {
          // Action handling
          if (f.fieldId.startsWith('action_')) {
            const actionType = f.fieldId.replace('action_', '');
            return config.actions.find(a => a.type === actionType)?.enabled ?? false;
          }
          // System fields
          if (SYSTEM_FIELDS.some(sf => sf.id === f.fieldId)) return true;
          // Regular fields
          return selectedFieldIds.includes(f.fieldId);
        });
      });

      // 3. Identify fields that MUST be present but aren't currently placed
      const allRequiredFieldIds = Array.from(new Set([
        ...SYSTEM_FIELDS.map(f => f.id),
        ...AVAILABLE_FIELDS.filter(f => {
          if (f.supportedTypes && config.baseType && !f.supportedTypes.includes(config.baseType)) return false;
          if (f.excludedTypes && config.baseType && f.excludedTypes.includes(config.baseType)) return false;
          return f.category === 'core' || f.mandatory || selectedFieldIds.includes(f.id);
        }).map(f => f.id),
        ...config.actions.filter(a => a.enabled).map(a => `action_${a.type}`)
      ]));

      const missingFieldIds = allRequiredFieldIds.filter(id => {
        // Check if placed in any section
        return !Object.values(currentModeConfig.sections).some(s => s.fields.some(f => f.fieldId === id));
      });

      if (missingFieldIds.length === 0) return;

      // 4. Place missing fields using auto-layout logic
      missingFieldIds.forEach(fieldId => {
        // Determine section hint
        let targetSection: SectionType = 'HEADER';
        let span = isWindows ? 4 : 12;
        
        const systemField = SYSTEM_FIELDS.find(f => f.id === fieldId);
        const availableField = AVAILABLE_FIELDS.find(f => f.id === fieldId);
        const isAction = fieldId.startsWith('action_');

        if (systemField) {
          targetSection = 'HEADER';
          span = isWindows ? 3 : 12;
        } else if (availableField) {
          targetSection = (availableField.sectionHint as SectionType) || 'HEADER';
          span = isWindows ? 4 : 12;
        } else if (isAction) {
          targetSection = 'ACTIONS';
          span = isWindows ? 4 : 12;
        }

        const section = currentModeConfig.sections[targetSection];
        
        // Find the next available row/col for this section
        const maxRow = section.fields.reduce((max, f) => Math.max(max, f.row), -1);
        const fieldsInLastRow = section.fields.filter(f => f.row === Math.max(0, maxRow));
        const lastColEnd = fieldsInLastRow.reduce((max, f) => Math.max(max, f.col + f.colSpan), 0);

        let row = Math.max(0, maxRow);
        let col = lastColEnd;

        if (col + span > 12) {
          row++;
          col = 0;
        }

        section.fields.push({ fieldId, row, col, colSpan: span });
      });
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
      baseType: (template.config as any).baseType || template.id, // Store strategy reference
      isSystemDefault: false, // New forms from templates are NOT system defaults
      isLocked: false,        // New forms from templates are NOT locked
      startNumber: 1000,
      rules: template.config.rules || DEFAULT_RULES,
      actions: template.config.actions || DEFAULT_ACTIONS,
      // Priority: Use template's layout if it exists, otherwise fallback to empty sections
      uiModeOverrides: template.config.uiModeOverrides || prev.uiModeOverrides,
    }));
    
    // Sync selectedFieldIds from template if available
    const fieldIds = new Set<string>();
    const baseType = (template.config as any).baseType || template.id;
    
    // Always include core fields for this type
    getCoreFieldIds(baseType).forEach(id => fieldIds.add(id));

    if (template.config.uiModeOverrides) {
      Object.values(template.config.uiModeOverrides).forEach(mode => {
        Object.values(mode.sections).forEach(section => {
          section.fields.forEach(f => {
            if (!f.fieldId.startsWith('action_') && !SYSTEM_FIELDS.some(sf => sf.id === f.fieldId)) {
              if (isFieldAllowed(f.fieldId, baseType)) {
                fieldIds.add(f.fieldId);
              }
            }
          });
        });
      });
    }
    
    setSelectedFieldIds(Array.from(fieldIds));
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
        errorHandler.showError({
          code: 'VAL_001',
          message: `Please fix the following issues:\n${Object.values(result.errors).filter(Boolean).join('\n')}`,
          severity: 'WARNING'
        } as any);
        return;
      }
    }
    
    // Run auto-placement after Actions step to sync enabled actions to layout
    if (currentStep === 5) {
      runAutoPlacement(); 
    }
    setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleStepClick = (stepId: number) => {
      // Only allow clicking on steps we've already reached or are current
      if (stepId <= currentStep) {
        if (stepId === 6) runAutoPlacement();
        setCurrentStep(stepId);
      } else {
        // Use Next button to proceed forward to ensure logic runs
        errorHandler.showError({
          code: 'NAV_001',
          message: 'Please use the "Next" button to proceed through the steps.',
          severity: 'INFO'
        } as any);
      }
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
          className="p-4 grid grid-cols-12 gap-2 relative min-h-[150px] grid-container"
          style={{ gridTemplateRows: `repeat(${Math.max(4, maxRow + 1)}, minmax(3.5rem, auto))` }}
        >
           {Array.from({ length: Math.max(4, maxRow + 1) * 12 }).map((_, i) => {
              const r = Math.floor(i / 12);
              const c = i % 12;
              return (
                <div 
                   key={`cell-${r}-${c}`}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => handleDropField(e, sectionName, r, c)}
                   className="border border-dashed border-gray-100 rounded h-full w-full absolute z-0 pointer-events-auto hover:bg-indigo-50/30 transition-colors"
                   style={{ gridRowStart: r + 1, gridColumnStart: c + 1 }}
                />
              );
           })}

           {layout.fields
             .filter((f: FieldLayout) => {
                if (SYSTEM_FIELDS.some(sf => sf.id === f.fieldId)) return true;
                if (f.fieldId.startsWith('action_')) {
                  const actionType = f.fieldId.replace('action_', '');
                  return config.actions.find(a => a.type === actionType)?.enabled;
                }
                return selectedFieldIds.includes(f.fieldId);
             })
             .map((field: FieldLayout, idx: number) => {
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

                 {/* Table Column Configuration (Live Interactive Table) */}
                 {config.isMultiLine && (
                    <div className="mt-8 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="bg-indigo-500 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20"><Layers size={20} /></div>
                             <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Live Table Designer</h3>
                                <p className="text-[10px] text-indigo-200">Click a column header to rename or resize it.</p>
                             </div>
                          </div>
                          {activeColumnId && (
                             <button 
                               onClick={() => setActiveColumnId(null)}
                               className="text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full border border-white/10 transition-colors"
                             >
                                Deselect Column
                             </button>
                          )}
                       </div>
                       
                       <div className="p-8 bg-slate-50/50">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed">
                                   <thead>
                                      <tr className="bg-slate-800 text-white divide-x divide-slate-700">
                                         <th className="w-12 p-3 text-center text-[10px] font-bold text-slate-500 bg-slate-100">#</th>
                                         {((config.tableColumns || []) as any[]).map((col: any, idx: number) => {
                                            const colId = typeof col === 'string' ? col : col.id;
                                            const isSelected = activeColumnId === colId;
                                            const meta = AVAILABLE_TABLE_COLUMNS.find(m => m.id === colId);
                                            const columnLabel = typeof col === 'string' ? (meta?.label || colId) : (col.labelOverride || meta?.label || colId);
                                            const colWidth = (typeof col !== 'string' && col.width) || 'auto';

                                            return (
                                               <th 
                                                 key={colId} 
                                                 onClick={() => setActiveColumnId(colId)}
                                                 style={{ 
                                                   width: colWidth === 'auto' ? undefined : colWidth,
                                                   minWidth: '120px'
                                                 }}
                                                 className={`p-0 cursor-pointer transition-all relative group ${isSelected ? 'bg-indigo-600 ring-2 ring-inset ring-white/20' : 'hover:bg-slate-700'}`}
                                               >
                                                  <div className="p-3">
                                                     <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-[10px] font-mono font-bold uppercase ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>{colId}</span>
                                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                           <button 
                                                             disabled={idx === 0}
                                                             onClick={(e) => {
                                                                e.stopPropagation();
                                                                const updated = [...((config.tableColumns || []) as any[])];
                                                                [updated[idx-1], updated[idx]] = [updated[idx], updated[idx-1]];
                                                                setConfig({...config, tableColumns: updated});
                                                             }}
                                                             className="p-1 hover:bg-white/20 rounded disabled:opacity-10"
                                                           >
                                                              <ArrowLeft size={12} />
                                                           </button>
                                                           <button 
                                                             disabled={idx === (config.tableColumns?.length || 0) - 1}
                                                             onClick={(e) => {
                                                                e.stopPropagation();
                                                                const updated = [...((config.tableColumns || []) as any[])];
                                                                [updated[idx+1], updated[idx]] = [updated[idx], updated[idx+1]];
                                                                setConfig({...config, tableColumns: updated});
                                                             }}
                                                             className="p-1 hover:bg-white/20 rounded disabled:opacity-10"
                                                           >
                                                              <ArrowRight size={12} />
                                                           </button>
                                                        </div>
                                                     </div>
                                                     {isSelected ? (
                                                        <input 
                                                          autoFocus
                                                          type="text"
                                                          value={columnLabel}
                                                          onClick={(e) => e.stopPropagation()}
                                                          onChange={(e) => {
                                                             const updated = [...((config.tableColumns || []) as any[])];
                                                             if (typeof col === 'string') {
                                                                updated[idx] = { id: colId, labelOverride: e.target.value };
                                                             } else {
                                                                updated[idx] = { ...col, labelOverride: e.target.value };
                                                             }
                                                             setConfig({...config, tableColumns: updated});
                                                          }}
                                                          className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs font-bold text-white focus:bg-white focus:text-indigo-600 outline-none transition-all"
                                                        />
                                                     ) : (
                                                        <div className="text-xs font-bold line-clamp-1">{columnLabel}</div>
                                                     )}
                                                  </div>
                                               </th>
                                            );
                                         })}
                                         <th className="w-10 bg-slate-900"></th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-100">
                                      {[1, 2, 3].map(rowIdx => (
                                         <tr key={rowIdx} className="divide-x divide-gray-50 border-b border-gray-100">
                                            <td className="p-3 text-center text-gray-300 text-[10px] font-bold bg-gray-50/50">{rowIdx}</td>
                                            {((config.tableColumns || []) as any[]).map((col: any) => (
                                               <td key={typeof col === 'string' ? col : col.id} className="p-3">
                                                  <div className="h-4 bg-gray-100 rounded-lg animate-pulse w-3/4"></div>
                                               </td>
                                            ))}
                                            <td className="p-3"></td>
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                             
                             {/* Column Property Bar */}
                             <div className="p-4 border-t border-gray-100 bg-slate-50 flex items-center justify-between">
                                {activeColumnId ? (
                                   <>
                                      <div className="flex items-center gap-6">
                                         <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Editing Column</label>
                                            <div className="flex items-center gap-2">
                                               <span className="font-bold text-slate-800">{activeColumnId}</span>
                                               <span className="text-gray-300">|</span>
                                               <span className="text-xs text-gray-500 italic">Configure sizing below</span>
                                            </div>
                                         </div>
                                         
                                         <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
                                            <div>
                                               <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Column Width</label>
                                               <div className="flex items-center gap-3">
                                                  <input 
                                                    type="range" min="1" max="100"
                                                    value={(() => {
                                                       const col = config.tableColumns?.find((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                                       const w = typeof col === 'string' ? undefined : col?.width;
                                                       if (!w || w === 'auto') return 25;
                                                       return parseInt(w) || 25;
                                                    })()}
                                                    onChange={(e) => {
                                                       const updated = (config.tableColumns || []).map((c: any) => {
                                                          const id = typeof c === 'string' ? c : c.id;
                                                          if (id === activeColumnId) {
                                                             const base = typeof c === 'string' ? { id: c } : c;
                                                             return { ...base, width: `${e.target.value}%` };
                                                          }
                                                          return c;
                                                       });
                                                       setConfig({...config, tableColumns: updated});
                                                    }}
                                                    className="w-40 accent-indigo-600"
                                                  />
                                                  <span className="text-xs font-mono font-bold text-indigo-600 w-12">
                                                     {(() => {
                                                        const col = config.tableColumns?.find((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                                        return (typeof col !== 'string' && col?.width) || 'auto';
                                                     })()}
                                                  </span>
                                                  <button 
                                                    onClick={() => {
                                                       const updated = (config.tableColumns || []).map((c: any) => {
                                                          const id = typeof c === 'string' ? c : c.id;
                                                          if (id === activeColumnId) {
                                                             const { width, ...rest } = typeof c === 'string' ? { id: c } : c;
                                                             return { ...rest, width: 'auto' };
                                                          }
                                                          return c;
                                                       });
                                                       setConfig({...config, tableColumns: updated});
                                                    }}
                                                    className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 uppercase"
                                                  >
                                                     Reset
                                                  </button>
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                      
                                      <div className="flex gap-2">
                                         <button 
                                           onClick={() => {
                                              const idx = config.tableColumns?.findIndex((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                              if (idx !== undefined && idx > 0) {
                                                 const updated = [...((config.tableColumns || []) as any[])];
                                                 [updated[idx-1], updated[idx]] = [updated[idx], updated[idx-1]];
                                                 setConfig({...config, tableColumns: updated});
                                              }
                                           }}
                                           className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-white transition-all flex items-center gap-1"
                                         >
                                            <ArrowLeft size={14} /> Move Left
                                         </button>
                                         <button 
                                           onClick={() => {
                                              const idx = config.tableColumns?.findIndex((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                              if (idx !== undefined && idx !== -1 && idx < (config.tableColumns?.length || 0) - 1) {
                                                 const updated = [...((config.tableColumns || []) as any[])];
                                                 [updated[idx+1], updated[idx]] = [updated[idx], updated[idx+1]];
                                                 setConfig({...config, tableColumns: updated});
                                              }
                                           }}
                                           className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-white transition-all flex items-center gap-1"
                                         >
                                            Move Right <ArrowRight size={14} />
                                         </button>
                                      </div>
                                   </>
                                ) : (
                                   <div className="flex items-center gap-3 text-gray-400">
                                      <MousePointerClick size={16} />
                                      <span className="text-xs">Click any column header to configure its properties.</span>
                                   </div>
                                )}
                             </div>
                          </div>
                          <p className="mt-4 text-[10px] text-gray-400 italic text-center uppercase tracking-widest font-bold">This is a live preview. Your changes here will reflect exactly in the final voucher.</p>
                       </div>
                    </div>
                 )}
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

                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                       <div>
                         <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Row Index</label>
                         <input 
                           type="number" min="0"
                           value={config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.row || 0}
                           onChange={(e) => updateSelectedField('row', Math.max(0, parseInt(e.target.value) || 0))}
                           className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-mono"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Column Start</label>
                         <input 
                           type="number" min="0" max="11"
                           value={config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.col || 0}
                           onChange={(e) => updateSelectedField('col', Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                           className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-mono"
                         />
                       </div>
                     </div>

                      {selectedField.id === 'lineItems' && (
                        <div className="pt-4 border-t border-gray-100">
                          <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Table Style</label>
                          <div className="grid grid-cols-2 gap-2">
                             <button
                               onClick={() => setConfig({...config, tableStyle: 'web'})}
                               className={`py-2 px-3 rounded border text-xs font-bold transition-all ${
                                 (config.tableStyle || 'web') === 'web' 
                                   ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                   : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                               }`}
                             >
                               Web Look
                             </button>
                             <button
                               onClick={() => setConfig({...config, tableStyle: 'classic'})}
                               className={`py-2 px-3 rounded border text-xs font-bold transition-all ${
                                 config.tableStyle === 'classic' 
                                   ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                   : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                               }`}
                             >
                               Classic Table
                             </button>
                          </div>
                        </div>
                      )}

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
                      readOnly={!!initialConfig?.id}
                      disabled={!!initialConfig?.id}
                      className={`mt-1 block w-full rounded-md shadow-sm p-2 border ${
                        !!initialConfig?.id 
                          ? 'bg-gray-100 text-gray-600 cursor-not-allowed' 
                          : 'bg-white text-slate-900'
                      } ${
                        validationErrors.id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {!!initialConfig?.id ? (
                      <p className="mt-1 text-xs text-gray-500">
                        🔒 Form ID cannot be changed after creation to maintain data integrity
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">
                        Auto-generated for cloned forms (e.g., JE_1234567890_C)
                      </p>
                    )}
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
      case 4: // Fields (Reorganized)
        const relevantFields = AVAILABLE_FIELDS.filter(f => {
          if (f.supportedTypes && config.baseType && !f.supportedTypes.includes(config.baseType)) return false;
          if (f.excludedTypes && config.baseType && f.excludedTypes.includes(config.baseType)) return false;
          return true;
        });

        const coreFields = relevantFields.filter(f => f.category === 'core' || f.mandatory);
        const optionalFields = relevantFields.filter(f => f.category !== 'core' && !f.mandatory);

        const renderFieldCard = (field: AvailableField) => {
          const isCore = field.category === 'core' || field.mandatory;
          const isSelected = isCore || selectedFieldIds.includes(field.id);
          
          return (
            <div 
              key={field.id} 
              onClick={() => {
                if (isCore) return; // Prevent toggling core fields
                setSelectedFieldIds(prev => isSelected ? prev.filter(f => f !== field.id) : [...prev, field.id]);
              }} 
              className={`
                p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all
                ${isSelected 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }
                ${isCore ? 'opacity-80 cursor-default' : 'cursor-pointer'}
              `}
            >
               <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{field.label}</span>
                    {isCore && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>Required</span>
                    )}
                  </div>
                  <span className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-gray-400 font-medium'}`}>
                    {field.id === 'lineItems' ? 'Main Table' : (field.sectionHint || 'HEADER')}
                  </span>
               </div>
               <div className="flex items-center gap-2">
                 {isSelected ? <CheckCircle2 size={18} className="text-white shadow-sm" /> : <div className="w-4 h-4 rounded-full border border-gray-200" />}
               </div>
            </div>
          );
        };

        return (
          <div className="max-w-4xl mx-auto space-y-8">
             <div className="space-y-6">
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                       <Shield size={12} /> Core System Fields
                    </h3>
                    <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded">Always Included</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {coreFields.map(renderFieldCard)}
                  </div>
                </section>

                <section className="pt-4 border-t border-gray-100">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                    <Layers size={12} /> Optional & Shared Fields
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {optionalFields.map(renderFieldCard)}
                  </div>
                </section>
             </div>


             {config.isMultiLine && (
               <div className="space-y-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase text-center border-t border-gray-100 pt-6">Table Columns Selection</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                     {AVAILABLE_TABLE_COLUMNS.map(col => {
                        const currentCols = (config.tableColumns || []) as any[];
                        // Standardize 'account' check
                        const isSelected = currentCols.some(c => {
                           const id = (typeof c === 'string' ? c : c.id);
                           return id === col.id || (col.id === 'account' && id === 'accountSelector');
                        });
                        
                        return (
                           <div 
                             key={col.id} 
                             onClick={() => {
                                let updated;
                                if (isSelected) {
                                  updated = currentCols.filter(c => {
                                     const id = (typeof c === 'string' ? c : c.id);
                                     return id !== col.id && id !== 'account'; // Filter out both
                                  });
                                } else {
                                  updated = [...currentCols, { id: col.id, labelOverride: col.label }];
                                }
                                setConfig({...config, tableColumns: updated});
                             }}
                             className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg ring-4 ring-indigo-500/10 scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                           >
                              <span className="text-sm font-bold">{col.label}</span>
                              {isSelected ? <CheckCircle2 size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-gray-200" />}
                           </div>
                        );
                     })}
                  </div>
                  <p className="mt-4 text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">Labels and ordering are managed in the <span className="text-indigo-600">Visual Editor</span> step.</p>
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
                    <GenericVoucherRenderer definition={config as any} mode={previewMode} />
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
      <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-200 shrink-0 overflow-x-auto gap-4">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isPlayable = step.id <= currentStep; // User can click back
          const Icon = step.icon;
          
          return (
            <div 
              key={step.id} 
              onClick={() => handleStepClick(step.id)}
              className={`flex flex-col items-center relative z-10 w-24 min-w-[6rem] transition-all group ${!isPlayable ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all 
                ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg ring-4 ring-indigo-100 scale-110' : isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400 group-hover:border-indigo-300'}
              `}>
                {isCompleted ? <Check size={20} /> : <Icon size={20} />}
              </div>
              <div className="text-center mt-2">
                <span className={`text-[10px] font-black uppercase tracking-tighter block leading-none ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {step.title}
                </span>
                {isActive && step.description && (
                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-tight whitespace-nowrap">{step.description}</span>
                )}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`absolute top-5 left-[calc(50%+1.25rem)] w-[calc(100%-2rem)] h-0.5 -z-10 ${step.id < currentStep ? 'bg-green-400' : 'bg-gray-100'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
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
