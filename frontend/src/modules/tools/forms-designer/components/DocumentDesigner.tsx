/**
 * Document Wizard - Main Designer Component
 * 
 * ⚠️ THIS IS PURE UI - NO ACCOUNTING LOGIC
 * 
 * This is a multi-step wizard that collects user choices about:
 * - Document name, prefix, numbering
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
 * Output: Plain DocumentFormConfig object via onSave callback
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { validateUniqueness } from '../validators/uniquenessValidator';
import { 
  ArrowLeft, ArrowRight, Check, CheckCircle2, Plus,
  LayoutTemplate, Settings, 
  FileText, Shield, Layers, PlayCircle, MousePointerClick, Save,
  GripVertical, X, Sliders, ChevronDown, ChevronRight, Palette
} from 'lucide-react';
import { 
  DocumentFormConfig, FieldLayout, UIMode, AvailableField, 
  DocumentRule, DocumentAction, SectionLayout, SectionType
} from '../types';
import { GenericVoucherRenderer } from '../../../accounting/components/shared/GenericVoucherRenderer';
import { errorHandler } from '../../../../services/errorHandler';

// --- MOCK DATA (UI ONLY) ---

// Constants are now passed as props to make this designer generic

// Template definitions (factory presets)
interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBlank: boolean;
  config: Partial<DocumentFormConfig>;
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

interface DocumentDesignerProps {
  initialConfig?: DocumentFormConfig | null;
  availableTemplates?: DocumentFormConfig[]; // Templates from database
  onSave?: (config: DocumentFormConfig) => void;
  onCancel?: () => void;
  systemFields: AvailableField[];
  availableFields: AvailableField[];
  availableTableColumns?: any[];
  defaultRules: DocumentRule[];
  defaultActions: DocumentAction[];
}

export const DocumentDesigner: React.FC<DocumentDesignerProps> = ({ 
  initialConfig, 
  availableTemplates = [],
  onSave, 
  onCancel,
  systemFields = [],
  availableFields = [],
  availableTableColumns = [],
  defaultRules = [],
  defaultActions = []
}) => {
  const { companyId } = useCompanyAccess();
  
  // Wizard State
  // Skip Step 1 (template selection) if editing existing document
  const [currentStep, setCurrentStep] = useState(initialConfig ? 2 : 1);
  
  const isFieldMandatory = (fieldId: string, baseType?: string) => {
    // 1. Check system fields first (hardcoded logic)
    const systemField = systemFields.find(f => f.id === fieldId);
    if (systemField?.mandatory || systemField?.category === 'core') return true;

    // 2. Check the base template definition if available in the props
    const effectiveBaseType = baseType || config?.baseType;
    const baseTemplate = availableTemplates.find(t => t.id === effectiveBaseType || t.code === effectiveBaseType);
    if (baseTemplate) {
      const isHeaderMandatory = (baseTemplate.headerFields || []).some((f: any) => (f.id === fieldId || f.name === fieldId) && (f.mandatory || f.required));
      const isLineMandatory = (baseTemplate.lineFields || []).some((f: any) => (f.id === fieldId || f.name === fieldId) && (f.mandatory || f.required));
      if (isHeaderMandatory || isLineMandatory) return true;
    }

    // 3. Fallback to the field's own mandatory flag if it exists (for standalone fields)
    const field = availableFields.find(f => f.id === fieldId);
    return field?.mandatory || false;
  };

  const getCoreFieldIds = (baseType?: string) => {
    return [...systemFields, ...availableFields].filter(f => {
      const mandatory = isFieldMandatory(f.id, baseType);
      if (!mandatory) return false;
      if (f.supportedTypes && baseType && !f.supportedTypes.includes(baseType)) return false;
      if (f.excludedTypes && baseType && f.excludedTypes.includes(baseType)) return false;
      return true;
    }).map(f => f.id);
  };

  // --- GRID CONSTANTS ---
  const GRID_COLS = 24;

  const isFieldAllowed = (fieldId: string, baseType?: string) => {
    const field = availableFields.find(f => f.id === fieldId);
    if (!field) return true; // System fields or unknown fields allowed by default
    if (field.supportedTypes && baseType && !field.supportedTypes.includes(baseType)) return false;
    if (field.excludedTypes && baseType && field.excludedTypes.includes(baseType)) return false;
    return true;
  };

  // --- MIGRATION UTILITY ---
  // If a layout has fields with colSpan <= 12 and max width <= 12, it might be from the old system
  const migrateTo24Columns = (configToMigrate: DocumentFormConfig) => {
    if (!configToMigrate.uiModeOverrides) return configToMigrate;
    
    // We check classic mode as a benchmark
    const needsMigration = Object.values(configToMigrate.uiModeOverrides).some(mode => {
      return Object.values(mode.sections).some(section => 
        section.fields.some(f => (f.col + f.colSpan) <= 12 && f.colSpan > 0 && f.colSpan < 12)
      );
    });

    if (!needsMigration) return configToMigrate;

    const newConfig = JSON.parse(JSON.stringify(configToMigrate));
    Object.values(newConfig.uiModeOverrides).forEach((mode: any) => {
      Object.values(mode.sections).forEach((section: any) => {
        section.fields.forEach((f: any) => {
          // Double the horizontal coordinates
          f.col = f.col * 2;
          f.colSpan = f.colSpan * 2;
        });
      });
    });
    
    return newConfig;
  };

  // Initialize with all core and required fields by default
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(() => {
    // Start with core/mandatory fields if not provided
    if (initialConfig?.id && initialConfig?.id !== 'new_document_form') {
       // Extract unique field IDs from existing sections
       const existingFields = new Set<string>();
       if (initialConfig.uiModeOverrides) {
         Object.values(initialConfig.uiModeOverrides).forEach((mode: any) => {
           if (mode?.sections) {
             Object.values(mode.sections).forEach((s: any) => {
                if (s?.fields && Array.isArray(s.fields)) {
                  s.fields.forEach((f: any) => {
                    if (f?.fieldId && !f.fieldId.startsWith('action_') && isFieldAllowed(f.fieldId, initialConfig.baseType)) {
                      existingFields.add(f.fieldId);
                    }
                  });
                }
             });
           }
         });
       }
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
  const [config, setConfig] = useState<DocumentFormConfig>(() => {
    let initial = initialConfig;
    if (initial) {
      // Automatic migration for older 12-column documents
      initial = migrateTo24Columns(initial);
      return { ...initial, isMultiLine: true };
    }
    
    // Default config for new forms
    const base: Partial<DocumentFormConfig> = {
      id: 'new_document_form',
      name: 'New Document Form',
      prefix: 'V-',
      startNumber: 1000,
      rules: defaultRules,
      isMultiLine: true,
      tableColumns: [],
      actions: defaultActions,
      uiModeOverrides: null as any
    };

    // Ensure uiModeOverrides is NEVER null and has both modes initialized
    if (!base.uiModeOverrides) {
       (base as any).uiModeOverrides = {};
    }
    
    const modes: UIMode[] = ['classic', 'windows'];
    modes.forEach(mode => {
      if (!base.uiModeOverrides[mode] || !base.uiModeOverrides[mode].sections) {
        base.uiModeOverrides[mode] = {
          sections: {
            HEADER: { order: 0, fields: [] },
            BODY: { order: 1, fields: [] },
            EXTRA: { order: 2, fields: [] },
            FOOTER: { order: 3, fields: [] },
            ACTIONS: { order: 4, fields: [] }
          }
        };
      } else if (!base.uiModeOverrides[mode].sections.FOOTER) {
        // Migration patch for existing configurations that lack a FOOTER section
        base.uiModeOverrides[mode].sections.FOOTER = { order: 3, fields: [] };
        if (base.uiModeOverrides[mode].sections.ACTIONS) {
          base.uiModeOverrides[mode].sections.ACTIONS.order = 4;
        }
      }
    });

    return base as DocumentFormConfig;
  });

  const [previewMode, setPreviewMode] = useState<UIMode>('windows');
  
  // UI State
  const [selectedField, setSelectedField] = useState<{ id: string, section: string } | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['required', 'columns']);
  const [expandedVisualSections, setExpandedVisualSections] = useState<string[]>(['HEADER', 'BODY', 'FOOTER']);

  // Check if document is read-only (system default or locked)
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
          const modeConfig = uiOverrides[mode];
          const sections = modeConfig?.sections;
          if (sections) {
            Object.values(sections).forEach((section: any) => {
              if (section?.fields && Array.isArray(section.fields)) {
                section.fields.forEach((f: any) => {
                  const id = f.fieldId || f.id || f;
                  if (id && isFieldAllowed(id, initialConfig.baseType)) {
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

  useEffect(() => {
    if (currentStep === 6) {
      runAutoPlacement();
    }
  }, [currentStep, selectedFieldIds, config.actions]);

  // CLEANUP: Automatically remove table columns that are no longer in availableTableColumns or have no ID
  useEffect(() => {
    if (!availableTableColumns || availableTableColumns.length === 0) return;
    
    const validIds = new Set(availableTableColumns.map(c => c.id));
    const currentCols = (config.tableColumns || []) as any[];
    
    const cleaned = currentCols.filter(col => {
      const id = typeof col === 'string' ? col : col.id;
      return id && (validIds.has(id) || (id === 'accountSelector' && validIds.has('account')));
    });
    
    if (cleaned.length !== currentCols.length) {
      setConfig(prev => ({ ...prev, tableColumns: cleaned }));
    }
  }, [availableTableColumns, config.id, currentStep]); // Run when available columns change, document changes, or step changes

  // Convert database templates to UI template format
  const templates: DocumentTemplate[] = [
    ...availableTemplates.map((t: DocumentFormConfig) => ({
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

  const runAutoPlacement = () => {
    const modes: UIMode[] = ['windows', 'classic'];
    // Deep copy to avoid mutation issues
    const newOverrides = JSON.parse(JSON.stringify(config.uiModeOverrides || {}));

    modes.forEach(mode => {
      const isWindows = mode === 'windows';
      if (!newOverrides[mode]) {
        newOverrides[mode] = {
           sections: {
            HEADER: { order: 0, fields: [] },
            BODY: { order: 1, fields: [] },
            EXTRA: { order: 2, fields: [] },
            FOOTER: { order: 3, fields: [] },
            ACTIONS: { order: 4, fields: [] }
          }
        };
      }
      
      const currentModeConfig = newOverrides[mode];
      
      // Ensure all standard sections exist
      const standardSections: SectionType[] = ['HEADER', 'BODY', 'EXTRA', 'FOOTER', 'ACTIONS'];
      standardSections.forEach(s => {
        if (!currentModeConfig.sections[s]) {
          currentModeConfig.sections[s] = { order: standardSections.indexOf(s), fields: [] };
        }
      });

      // 1. Filter out fields that are no longer selected or actions that are no longer enabled
      Object.keys(currentModeConfig.sections).forEach(sectionKey => {
        const section = currentModeConfig.sections[sectionKey as SectionType];
        if (section?.fields) {
          section.fields = section.fields.filter(f => {
            if (f.fieldId.startsWith('action_')) {
              const actionType = f.fieldId.replace('action_', '');
              return config.actions.find(a => a.type === actionType)?.enabled ?? false;
            }
            return selectedFieldIds.includes(f.fieldId);
          });
        }
      });

      // 2. Identify missing fields
      const allRequiredFieldIds = Array.from(new Set([
        ...[...systemFields, ...availableFields].filter(f => {
          if (f.supportedTypes && config.baseType && !f.supportedTypes.includes(config.baseType)) return false;
          if (f.excludedTypes && config.baseType && f.excludedTypes.includes(config.baseType)) return false;
          return selectedFieldIds.includes(f.id);
        }).map(f => f.id),
        ...config.actions.filter(a => a.enabled).map(a => `action_${a.type}`)
      ]));

      const missingFieldIds = allRequiredFieldIds.filter(id => {
        return !Object.values(currentModeConfig.sections).some((s: any) => s.fields.some((f: any) => f.fieldId === id));
      });

      if (missingFieldIds.length === 0) return; // Skip this mode

      // 3. Place missing fields
      missingFieldIds.forEach(fieldId => {
        let targetSection: SectionType = 'HEADER';
        let span = isWindows ? 8 : 24; // Scaled for 24 columns
        
        const systemField = systemFields.find(f => f.id === fieldId);
        const availableField = availableFields.find(f => f.id === fieldId);
        const isAction = fieldId.startsWith('action_');

        if (systemField) {
          targetSection = (systemField.sectionHint as SectionType) || 'HEADER';
          span = systemField.id === 'lineItems' ? 24 : (isWindows ? 6 : 24);
        } else if (availableField) {
          targetSection = (availableField.sectionHint as SectionType) || 'HEADER';
          span = isWindows ? 8 : 24;
        } else if (isAction) {
          targetSection = 'ACTIONS';
          span = isWindows ? 4 : 24; // Actions are usually smaller
        }

        // Final safety check for target section existence
        if (!currentModeConfig.sections[targetSection]) {
          targetSection = 'HEADER';
        }

        const section = currentModeConfig.sections[targetSection];
        const maxRow = section.fields.reduce((max: number, f: any) => Math.max(max, f.row), -1);
        const fieldsInLastRow = section.fields.filter((f: any) => f.row === Math.max(0, maxRow));
        const lastColEnd = fieldsInLastRow.reduce((max: number, f: any) => Math.max(max, f.col + f.colSpan), 0);

        let row = Math.max(0, maxRow);
        let col = lastColEnd;

        if (col + span > 24) { // Updated for 24 columns
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
    const template = templates.find((t: DocumentTemplate) => t.id === templateId);
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
      rules: template.config.rules || defaultRules,
      actions: template.config.actions || defaultActions,
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
            if (!f.fieldId.startsWith('action_') && !systemFields.some(sf => sf.id === f.fieldId)) {
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
      
      // Also check prefix doesn't contain placeholder characters
      if (/[{}]/.test(config.prefix)) {
        result.errors.prefix = 'Prefix must not contain { or } characters. Use the Number Format field below for templates.';
        result.isValid = false;
      }

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
    
    // Find the field being dragged
    const primaryFieldIndex = sourceFields.findIndex((f: FieldLayout) => f.fieldId === fieldId);
    if (primaryFieldIndex === -1) return;
    const primaryField = sourceFields[primaryFieldIndex];

    // Check if it's an action and compact (part of a group)
    const isAction = primaryField.fieldId.startsWith('action_');
    const isCompact = isAction && (primaryField.displayMode === 'compact' || primaryField.displayMode === 'badge' || primaryField.isCompact);
    
    let fieldsToMove: FieldLayout[] = [];
    
    if (isAction && isCompact) {
       // Identify the entire row's contiguous compact action group
       const rowFields = sourceFields.filter(f => f.row === primaryField.row && f.fieldId.startsWith('action_') && (f.displayMode === 'compact' || f.displayMode === 'badge' || f.isCompact));
       rowFields.sort((a, b) => a.col - b.col); // Must be sorted by column
       
       // Ensure the primary field is actually in this group
       const primaryIdxInRow = rowFields.findIndex(f => f.fieldId === fieldId);
       
       if (primaryIdxInRow !== -1) {
           // We'll move the ENTIRE group. 
           // Extract them from source
           fieldsToMove = rowFields;
           
           // Remove all grouped fields from the source section
           const fieldIdsToRemove = new Set(fieldsToMove.map(f => f.fieldId));
           modeConfig.sections[sourceSection as SectionType].fields = sourceFields.filter(f => !fieldIdsToRemove.has(f.fieldId));
           
           // Place them in the target section, maintaining relative column offsets
           let currentColOffset = targetCol;
           fieldsToMove.forEach(f => {
              f.row = targetRow;
              f.col = currentColOffset;
              currentColOffset += (f.colSpan || 1);
           });
       } else {
           // Fallback if logic fails somehow
           fieldsToMove = sourceFields.splice(primaryFieldIndex, 1);
           fieldsToMove[0].row = targetRow;
           fieldsToMove[0].col = targetCol;
       }
    } else {
       // Single standard field move
       fieldsToMove = sourceFields.splice(primaryFieldIndex, 1);
       fieldsToMove[0].row = targetRow;
       fieldsToMove[0].col = targetCol;
    }

    const targetFields = modeConfig.sections[targetSection as SectionType].fields;
    targetFields.push(...fieldsToMove);

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
    const container = document.querySelector('.grid-container') as HTMLElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cellWidth = rect.width / GRID_COLS;
    const deltaX = e.clientX - resizingRef.current.startX;
    const colDelta = Math.round(deltaX / cellWidth);
    
    const overrides = { ...config.uiModeOverrides };
    const fields = overrides[previewMode].sections[section as SectionType].fields;
    const field = fields.find((f: FieldLayout) => f.fieldId === fieldId);
    if (!field) return;

    const newSpan = Math.max(1, Math.min(GRID_COLS - field.col, resizingRef.current.startSpan + colDelta));
    
    if (newSpan !== field.colSpan) {
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
     
     const container = document.querySelector('.grid-container') as HTMLElement;
     const rect = container?.getBoundingClientRect() || { width: 1000, left: 0 };
     const cellWidth = rect.width / GRID_COLS;
     const mouseX = 0; // Simplified for logic
     const col = Math.floor(mouseX / cellWidth);
     
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


  const updateSectionStyle = (sectionName: string, color: string) => {
    const overrides = { ...config.uiModeOverrides };
    overrides[previewMode].sections[sectionName as SectionType].backgroundColor = color;
    setConfig(prev => ({ ...prev, uiModeOverrides: overrides }));
  };

  // Safely extract layout with fallback to prevent crashes
  const currentModeConfig = config.uiModeOverrides?.[previewMode] || { sections: {} };
  const sortedSections = Object.entries(currentModeConfig.sections || {})
    .sort(([, a], [, b]) => (a as SectionLayout).order - (b as SectionLayout).order);

  const renderInteractiveGrid = (sectionName: string) => {
    const layout = config.uiModeOverrides?.[previewMode]?.sections?.[sectionName as SectionType] || { order: 0, fields: [] };
    if (!layout) return null;

    const isExpanded = expandedVisualSections.includes(sectionName);
    const maxRow = layout.fields.reduce((max: number, f: FieldLayout) => Math.max(max, f.row), 0) + 1;
    const bgColorClass = layout.backgroundColor || 'bg-white';

    const softColors = [
      { id: 'white', hex: '#ffffff', class: 'bg-white' },
      { id: 'gray', hex: '#f8fafc', class: 'bg-slate-50' },
      { id: 'sky', hex: '#eff6ff', class: 'bg-sky-50' },
      { id: 'teal', hex: '#f0fdfa', class: 'bg-teal-50' },
      { id: 'indigo', hex: '#eef2ff', class: 'bg-indigo-50' },
      { id: 'rose', hex: '#fff1f2', class: 'bg-rose-50' },
    ];

    // Find the hex color for the current selection to use in styles
    const currentHex = layout.backgroundColor || '#ffffff';

    return (
      <div 
        key={sectionName}
        className={`mb-6 border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all relative group ${bgColorClass}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDropField(e, sectionName, maxRow, 0)}
      >
        <div className={`px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white/60 backdrop-blur-sm sticky top-0 z-[15]`}>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setExpandedVisualSections(prev => prev.includes(sectionName) ? prev.filter(s => s !== sectionName) : [...prev, sectionName])}
               className="p-1 hover:bg-gray-100 rounded text-gray-400"
             >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
             </button>
             <div className="p-1.5 bg-gray-50 rounded border border-gray-200"><GripVertical size={12} className="text-gray-400" /></div>
             <div>
                <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none block">{sectionName} SECTION</span>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">
                   {layout.fields.length} Fields {layout.fields.length === 0 && '• EMPTY'}
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Background Style Picker */}
             <div className="flex items-center gap-1.5 p-1 bg-gray-50 rounded-lg border border-gray-100">
                <Palette size={12} className="text-gray-400 mx-1" />
                {softColors.map(color => (
                   <button
                     key={color.id}
                     onClick={() => updateSectionStyle(sectionName, color.hex)}
                     className={`w-4 h-4 rounded-full border-2 transition-all ${color.class} ${currentHex === color.hex ? 'border-indigo-500 scale-125 shadow-sm' : 'border-white hover:scale-110 shadow-xs'}`}
                     title={`Set background to ${color.id}`}
                   />
                ))}
             </div>

             <div className="h-6 w-px bg-gray-200"></div>

             <div className="flex gap-1">
                <button 
                  onClick={() => updateSectionOrder(sectionName, layout.order - 1)} 
                  disabled={layout.order === 0} 
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-20"
                >
                   <ArrowLeft size={14} className="rotate-90" />
                </button>
                <button 
                  onClick={() => updateSectionOrder(sectionName, layout.order + 1)} 
                  disabled={layout.order === 4} 
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-20"
                >
                   <ArrowRight size={14} className="rotate-90" />
                </button>
             </div>
          </div>
        </div>

        {isExpanded ? (
          <div 
            className="p-6 grid grid-cols-24 gap-3 relative min-h-[160px] grid-container animate-in fade-in duration-300"
            style={{ backgroundColor: currentHex, gridTemplateRows: `repeat(${Math.max(4, maxRow + 1)}, minmax(3.5rem, auto))` }}
          >
             {Array.from({ length: Math.max(4, maxRow + 1) * GRID_COLS }).map((_, i) => {
                const r = Math.floor(i / GRID_COLS);
                const c = i % GRID_COLS;
                return (
                  <div 
                     key={`cell-${r}-${c}`}
                     onDragOver={(e) => e.preventDefault()}
                     onDrop={(e) => handleDropField(e, sectionName, r, c)}
                     className="border border-dashed border-gray-200/50 rounded-lg h-full w-full absolute z-0 pointer-events-auto hover:bg-indigo-500/5 transition-colors"
                     style={{ gridRowStart: r + 1, gridColumnStart: c + 1 }}
                  />
                );
             })}

           {(() => {
             const visibleFields = layout.fields.filter((f: FieldLayout) => {
                if (systemFields.some(sf => sf.id === f.fieldId)) return true;
                if (f.fieldId.startsWith('action_')) {
                  const actionType = f.fieldId.replace('action_', '');
                  return config.actions.find(a => a.type === actionType)?.enabled;
                }
                return selectedFieldIds.includes(f.fieldId);
             });
             
             const elements: React.ReactNode[] = [];
             let i = 0;
             
             while (i < visibleFields.length) {
                const field = visibleFields[i];
                const isAction = field.fieldId.startsWith('action_');
                const isCompact = isAction && (field.displayMode === 'compact' || field.displayMode === 'badge' || field.isCompact);
                
                if (isAction && isCompact) {
                   const group = [field];
                   let j = i + 1;
                   while (j < visibleFields.length) {
                      const nextField = visibleFields[j];
                      const nextIsAction = nextField.fieldId.startsWith('action_');
                      const nextIsCompact = nextIsAction && (nextField.displayMode === 'compact' || nextField.displayMode === 'badge' || nextField.isCompact);
                      
                      if (nextIsCompact && nextField.row === field.row) {
                         group.push(nextField);
                         j++;
                      } else {
                         break;
                      }
                   }
                   
                   if (group.length > 1) {
                      // Render grouped generic actions block
                      const totalColSpan = group.reduce((sum, f) => sum + (f.colSpan || 1), 0);
                      const isAnySelected = group.some(f => f.fieldId === selectedField?.id);
                      
                      elements.push(
                         <div 
                           key={`group_${field.row}_${field.col}`}
                           draggable
                           onDragStart={(e) => {
                             // Only drag the first field as a proxy for the group drop logic, 
                             // Though true grouped dragging would require more complex offset logic
                             handleDragStartField(e, field.fieldId, sectionName);
                           }}
                           onClick={(e) => { e.stopPropagation(); setSelectedField({ id: field.fieldId, section: sectionName }); }}
                           className={`
                             rounded-lg border p-1 flex justify-center text-xs relative z-10 select-none shadow-sm group/item transition-all
                             ${isAnySelected ? 'ring-2 ring-indigo-500 border-indigo-500 z-20 bg-indigo-50/50' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400 cursor-move'}
                           `}
                           style={{
                             gridColumnStart: group[0].col + 1,
                             gridColumnEnd: `span ${totalColSpan}`,
                             gridRowStart: group[0].row + 1,
                             gridRowEnd: `span ${group[0].rowSpan || 1}`,
                           }}
                         >
                           <div className="flex w-full h-full items-center justify-center divide-x divide-gray-200">
                             {group.map((gf: any) => {
                                const actionType = gf.fieldId.replace('action_', '');
                                const actionDef = config.actions.find(a => a.type === actionType);
                                const label = gf.labelOverride || actionDef?.label || actionType;
                                const isSelected = selectedField?.id === gf.fieldId;
                                
                                return (
                                  <div 
                                    key={gf.fieldId}
                                    className={`flex-1 h-full flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-50'}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedField({ id: gf.fieldId, section: sectionName }); }}
                                  >
                                    <span className="font-medium text-[10px] uppercase truncate px-1 text-center">{gf.iconOverride || 'Icon'}</span>
                                  </div>
                                );
                             })}
                           </div>
                           
                           {/* Resize Handle */}
                           <div 
                             className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-400/50 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center z-30"
                             onMouseDown={(e) => startResize(e, sectionName, group[group.length-1].fieldId, group[group.length-1].colSpan)}
                           >
                              <div className="w-0.5 h-4 bg-gray-400 rounded-full"></div>
                           </div>
                         </div>
                      );
                      i = j;
                      continue;
                   }
                }
                
                // Standard un-grouped field rendering
                const meta = [...systemFields, ...availableFields].find(f => f.id === field.fieldId) 
                           || (isAction ? { label: config.actions.find(a => `action_${a.type}` === field.fieldId)?.label || 'Action', type: 'button' } : null);
                
                const isSelected = selectedField?.id === field.fieldId;

                elements.push(
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
                      gridRowEnd: `span ${field.rowSpan || 1}`,
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
                i++;
             }
             return elements;
           })()}
        </div>
        ) : null}
      </div>
    );
  };

  // --- COLUMN RESIZING LOGIC ---

  const columnResizeRef = useRef<{ colIndex: number, startX: number, startWidth: number } | null>(null);

  const onColumnResizeMove = (e: MouseEvent) => {
      if (!columnResizeRef.current) return;
      const { colIndex, startX, startWidth, tableWidth } = columnResizeRef.current;
      const delta = e.clientX - startX;
      
      const newWidthPx = Math.max(40, startWidth + delta);
      // Calculate percentage based on total table width
      const newWidthPct = Math.min(100, Math.round((newWidthPx / tableWidth) * 100));
      
      const updated = [...((config.tableColumns || []) as any[])];
      const col = updated[colIndex];
      const base = typeof col === 'string' ? { id: col } : col;
      updated[colIndex] = { ...base, width: `${newWidthPct}%` };
      
      setConfig(prev => ({ ...prev, tableColumns: updated }));
  };

  const onColumnResizeEnd = () => {
    columnResizeRef.current = null;
    window.removeEventListener('mousemove', onColumnResizeMove);
    window.removeEventListener('mouseup', onColumnResizeEnd);
  };

  const startColumnResize = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const thElement = (e.currentTarget.parentElement as HTMLElement); 
    const tableElement = thElement.closest('table');
    const tableWidth = tableElement ? tableElement.offsetWidth : 1000;

    columnResizeRef.current = {
      colIndex,
      startX: e.clientX,
      startWidth: thElement ? thElement.offsetWidth : 100,
      tableWidth
    } as any;

    window.addEventListener('mousemove', onColumnResizeMove);
    window.addEventListener('mouseup', onColumnResizeEnd);
  };
  
  // --- COLUMN REORDERING LOGIC ---
  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const type = e.dataTransfer.getData('type');
      if (type !== 'column') return;
      
      const sourceIndex = parseInt(e.dataTransfer.getData('colIndex'));
      if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
      
      const updated = [...((config.tableColumns || []) as any[])];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      
      setConfig(prev => ({ ...prev, tableColumns: updated }));
      setActiveColumnId(null); // Clear selection to avoid confusion
  };

  const renderVisualEditor = () => {
    return (
      <div className="max-w-7xl mx-auto h-full flex gap-6">
         {/* Main Canvas */}
         <div className="flex-1 flex flex-col min-w-0">
             <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-50 z-20 py-2">
                <div>
                   <h2 className="text-lg font-bold text-gray-800">Visual Layout Editor</h2>
                   <p className="text-xs text-gray-500">Drag fields to move/resize. Drag table headers to reorder/resize.</p>
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
                                <div className="flex items-center gap-3">
                                   <p className="text-[10px] text-indigo-200 font-medium">Drag headers to reorder. Drag edges to resize. Click to rename.</p>
                                   <button 
                                     onClick={() => setShowColumnPicker(!showColumnPicker)}
                                     className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border transition-all font-sans flex items-center gap-1.5 ${showColumnPicker ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/10' : 'text-white/40 hover:text-white bg-white/5 border-white/10'}`}
                                   >
                                     {showColumnPicker ? 'Done' : 'Manage Columns'}
                                     <Settings size={10} className={showColumnPicker ? 'animate-spin-slow' : ''} />
                                   </button>
                                </div>
                             </div>
                          </div>
                          {activeColumnId && (
                             <button 
                               onClick={() => setActiveColumnId(null)}
                               className="text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full border border-white/10 transition-colors font-sans"
                             >
                                Deselect Column
                             </button>
                          )}
                       </div>

                       {showColumnPicker && (
                          <div className="bg-slate-800 border-b border-white/10 p-6 animate-in slide-in-from-top duration-300">
                             <div className="flex items-center justify-between mb-4">
                                <div>
                                   <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Available Table Columns</h4>
                                   <p className="text-[10px] text-white/40 font-medium font-sans">Toggle columns to add or remove them from the table</p>
                                </div>
                                <div className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-1 rounded font-sans">
                                   {(config.tableColumns || []).length} / {availableTableColumns.length} Active
                                </div>
                             </div>
                             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {availableTableColumns.map(col => {
                                   const currentCols = (config.tableColumns || []) as any[];
                                   const isSelected = currentCols.some(c => (typeof c === 'string' ? c : c.id) === col.id);
                                   
                                   return (
                                      <button 
                                         key={col.id}
                                         onClick={() => {
                                            let updated;
                                            if (isSelected) {
                                               updated = currentCols.filter(c => (typeof c === 'string' ? c : c.id) !== col.id);
                                            } else {
                                               updated = [...currentCols, { id: col.id, labelOverride: col.label }];
                                            }
                                            setConfig({...config, tableColumns: updated});
                                         }}
                                         className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all border font-sans ${
                                            isSelected 
                                               ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-inner' 
                                               : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                         }`}
                                      >
                                         <span className="truncate mr-2 font-sans">{col.label}</span>
                                         {isSelected ? <Check size={12} /> : <Plus size={12} />}
                                      </button>
                                   );
                                })}
                             </div>
                          </div>
                       )}
                       
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
                                            const meta = availableTableColumns.find(m => m.id === colId);
                                            const columnLabel = typeof col === 'string' ? (meta?.label || colId) : (col.labelOverride || meta?.label || colId);
                                            const colWidth = (typeof col !== 'string' && col.width) || 'auto';

                                            return (
                                               <th 
                                                 key={colId} 
                                                 onClick={() => setActiveColumnId(colId)}
                                                 onDragOver={(e) => e.preventDefault()}
                                                 onDrop={(e) => handleColumnDrop(e, idx)}
                                                 style={{ 
                                                   width: colWidth,
                                                   minWidth: '100px',
                                                   maxWidth: '600px'
                                                 }}
                                                 className={`p-0 relative group transition-colors ${isSelected ? 'bg-indigo-600' : 'hover:bg-slate-700'}`}
                                               >
                                                  <div className="p-3">
                                                     <div className="flex items-center gap-2 mb-1">
                                                        {/* Drag Handle */}
                                                        <div 
                                                          draggable
                                                          onDragStart={(e) => {
                                                             e.stopPropagation();
                                                             e.dataTransfer.setData('type', 'column');
                                                             e.dataTransfer.setData('colIndex', idx.toString());
                                                          }}
                                                          className="cursor-move text-slate-500 hover:text-white transition-colors"
                                                        >
                                                           <GripVertical size={14} />
                                                        </div>
                                                        <span className={`text-[10px] font-mono font-bold uppercase truncate ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>{colId}</span>
                                                     </div>
                                                     
                                                     {/* Inline Rename */}
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
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') setActiveColumnId(null);
                                                          }}
                                                          className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs font-bold text-white focus:bg-white focus:text-indigo-600 outline-none transition-all"
                                                        />
                                                     ) : (
                                                        <div className="text-xs font-bold text-left pl-6 truncate text-white drop-shadow-sm font-sans" title={columnLabel}>{columnLabel || 'No Label'}</div>
                                                     )}
                                                  </div>
                                                  
                                                  {/* Resize Handle */}
                                                  <div 
                                                     className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                     onMouseDown={(e) => startColumnResize(e, idx)}
                                                  >
                                                     <div className="w-0.5 h-4 bg-white/50 rounded-full"></div>
                                                  </div>
                                               </th>
                                            );
                                         })}
                                         <th className="w-10 bg-slate-900 border-l border-slate-700"></th>
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
                             
                             {/* Enhanced Property Bar */}
                             <div className="p-4 border-t border-gray-100 bg-slate-50 flex items-center justify-between min-h-[72px]">
                                {activeColumnId ? (
                                   <div className="flex items-center gap-6 w-full animate-in fade-in slide-in-from-left-2 duration-300">
                                      <div className="shrink-0">
                                         <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Editing Column</label>
                                         <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{activeColumnId}</span>
                                         </div>
                                      </div>
                                      
                                      <div className="h-8 w-px bg-gray-200"></div>

                                      <div className="flex items-center gap-4 flex-1">
                                         {/* Label Editor */}
                                         <div className="flex-1 max-w-[200px]">
                                             <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Header Label</label>
                                             <input 
                                                type="text"
                                                value={(() => {
                                                   const col = config.tableColumns?.find((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                                   const meta = availableTableColumns.find(m => m.id === activeColumnId);
                                                   if (typeof col === 'object' && col !== null) {
                                                      return col.labelOverride || meta?.label || activeColumnId;
                                                   }
                                                   return meta?.label || activeColumnId;
                                                })()}
                                                onChange={(e) => {
                                                   const updated = (config.tableColumns || []).map((c: any) => {
                                                      const id = typeof c === 'string' ? c : c.id;
                                                      if (id === activeColumnId) {
                                                         const base = typeof c === 'string' ? { id: c } : c;
                                                         return { ...base, labelOverride: e.target.value };
                                                      }
                                                      return c;
                                                   });
                                                   setConfig({...config, tableColumns: updated});
                                                }}
                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                             />
                                         </div>

                                         <div className="h-8 w-px bg-gray-200"></div>

                                         {/* Width Editor */}
                                         <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Width</label>
                                            <div className="flex items-center gap-2">
                                               <input 
                                                  type="text"
                                                  value={(() => {
                                                     const col = config.tableColumns?.find((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                                     return (typeof col !== 'string' && col?.width) || 'auto';
                                                  })()}
                                                  onChange={(e) => {
                                                      const updated = (config.tableColumns || []).map((c: any) => {
                                                         const id = typeof c === 'string' ? c : c.id;
                                                         if (id === activeColumnId) {
                                                            const base = typeof c === 'string' ? { id: c } : c;
                                                            let val = e.target.value;
                                                            if (val && !val.includes('%') && !isNaN(parseInt(val))) {
                                                               val = val + '%';
                                                            }
                                                            return { ...base, width: val || 'auto' };
                                                         }
                                                         return c;
                                                      });
                                                      setConfig({...config, tableColumns: updated});
                                                   }}
                                                  className="w-20 px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-center"
                                               />
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
                                                 className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 uppercase transition-colors"
                                               >
                                                  Reset
                                               </button>
                                            </div>
                                         </div>
                                      </div>

                                      {/* Manual Reorder Buttons */}
                                      <div className="flex gap-1 ml-auto">
                                         <button 
                                           onClick={() => {
                                              const idx = config.tableColumns?.findIndex((c: any) => (typeof c === 'string' ? c : c.id) === activeColumnId);
                                              if (idx !== undefined && idx > 0) {
                                                 const updated = [...((config.tableColumns || []) as any[])];
                                                 [updated[idx-1], updated[idx]] = [updated[idx], updated[idx-1]];
                                                 setConfig({...config, tableColumns: updated});
                                              }
                                           }}
                                           className="p-1.5 border border-gray-200 rounded text-gray-500 hover:bg-white hover:text-indigo-600 hover:border-indigo-300 transition-all"
                                           title="Move Left"
                                         >
                                            <ArrowLeft size={16} />
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
                                           className="p-1.5 border border-gray-200 rounded text-gray-500 hover:bg-white hover:text-indigo-600 hover:border-indigo-300 transition-all"
                                           title="Move Right"
                                         >
                                            <ArrowRight size={16} />
                                         </button>
                                      </div>
                                   </div>
                                ) : (
                                   <div className="flex items-center gap-4 text-gray-400 w-full">
                                      <div className="flex items-center gap-2">
                                         <div className="p-1.5 bg-gray-100 rounded text-gray-400"><MousePointerClick size={16} /></div>
                                         <span className="text-xs font-medium">Click column header to edit properties</span>
                                      </div>
                                      <div className="h-4 w-px bg-gray-200"></div>
                                      <div className="flex items-center gap-2">
                                         <div className="p-1.5 bg-gray-100 rounded text-gray-400"><GripVertical size={16} /></div>
                                         <span className="text-xs font-medium">Drag header to reorder</span>
                                      </div>
                                      <div className="h-4 w-px bg-gray-200"></div>
                                      <div className="flex items-center gap-2">
                                         <div className="p-1.5 bg-gray-100 rounded text-gray-400 flex"><ArrowLeft size={10} /><ArrowRight size={10} /></div>
                                         <span className="text-xs font-medium">Drag edge to resize</span>
                                      </div>
                                   </div>
                                )}
                             </div>

                          </div>
                          <p className="mt-4 text-[10px] text-gray-400 italic text-center uppercase tracking-widest font-bold">Live Preview</p>
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
                          value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.labelOverride || ''}
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
                             value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.colSpan || 1}
                             onChange={(e) => updateSelectedField('colSpan', parseInt(e.target.value))}
                             className="flex-1 accent-indigo-600 bg-white"
                           />
                           <span className="text-sm font-bold w-6 text-center text-slate-900">{config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.colSpan}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Grid has 12 columns total.</p>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Height (Rows)</label>
                        <div className="flex items-center gap-3">
                           <input 
                             type="range" min="1" max="6"
                             value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.rowSpan || 1}
                             onChange={(e) => updateSelectedField('rowSpan', parseInt(e.target.value))}
                             className="flex-1 accent-indigo-600 bg-white"
                           />
                           <span className="text-sm font-bold w-6 text-center text-slate-900">{config.uiModeOverrides[previewMode].sections[selectedField.section as SectionType].fields.find((f: FieldLayout) => f.fieldId === selectedField.id)?.rowSpan || 1}</span>
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Component Type</label>
                        <select 
                           value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.typeOverride || ''}
                           onChange={(e) => updateSelectedField('typeOverride', e.target.value)}
                           className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                        >
                           <option value="">Default</option>
                           <option value="text">Text Input</option>
                           <option value="textarea">Multi-line Text (Textarea)</option>
                           <option value="number">Number Input</option>
                           <option value="date">Date Picker</option>
                        </select>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase mt-4">Display Mode</label>
                        <select 
                           value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.displayMode || 'standard'}
                           onChange={(e) => updateSelectedField('displayMode', e.target.value)}
                           className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                        >
                           <option value="standard">{selectedField.id.startsWith('action_') ? 'Standard Button' : 'Standard Input'}</option>
                           {selectedField.id.startsWith('action_') ? (
                             <option value="compact">Icon Only</option>
                           ) : (
                             <>
                               <option value="compact">Compact Text</option>
                               <option value="badge">Badge</option>
                             </>
                           )}
                        </select>
                        {selectedField.id.startsWith('action_') ? (
                          <p className="text-[10px] text-gray-400 mt-1">Display this action as a compact icon</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 mt-1">Useful to display statuses or compact metadata</p>
                        )}
                     </div>

                     {selectedField.id.startsWith('action_') && (
                       <div className="mt-4">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Icon</label>
                          <select 
                             value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.iconOverride || ''}
                             onChange={(e) => updateSelectedField('iconOverride', e.target.value)}
                             className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                          >
                             <option value="">Default Icon</option>
                             <option value="Printer">Printer</option>
                             <option value="Save">Save</option>
                             <option value="Download">Download</option>
                             <option value="Mail">Mail</option>
                             <option value="Send">Send</option>
                             <option value="FileText">Document</option>
                             <option value="Check">Check</option>
                             <option value="X">Close (X)</option>
                             <option value="Upload">Upload</option>
                             <option value="Image">Image</option>
                             <option value="Excel">Excel</option>
                          </select>
                       </div>
                     )}

                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                       <div>
                         <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Row Index</label>
                         <input 
                           type="number" min="0"
                           value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.row || 0}
                           onChange={(e) => updateSelectedField('row', Math.max(0, parseInt(e.target.value) || 0))}
                           className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-mono"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Column Start</label>
                         <input 
                           type="number" min="0" max="11"
                           value={config.uiModeOverrides?.[previewMode]?.sections?.[selectedField.section as SectionType]?.fields?.find((f: FieldLayout) => f.fieldId === selectedField.id)?.col || 0}
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
                           <button
                             onClick={() => {
                               const tableDesigner = document.querySelector('.mt-8.bg-white.border.border-gray-200.rounded-xl');
                               if (tableDesigner) {
                                  tableDesigner.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  // Highlight the designer briefly
                                  tableDesigner.classList.add('ring-4', 'ring-indigo-500/50');
                                  setTimeout(() => tableDesigner.classList.remove('ring-4', 'ring-indigo-500/50'), 2000);
                               }
                             }}
                             className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all border border-slate-200 group"
                           >
                              <Settings size={14} className="group-hover:rotate-90 transition-transform duration-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest font-sans">Go to Column Designer</span>
                           </button>
                        </div>
                      )}

                     <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Move to Section</label>
                        <select 
                          value={selectedField.section}
                          onChange={(e) => moveSelectedFieldSection(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-slate-900"
                        >
                           {Object.keys(config.uiModeOverrides?.[previewMode]?.sections || {}).map(k => (
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
              {templates.map((template: DocumentTemplate) => (
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
                  ✓ Template selected! Click "Next" to customize your document.
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
                  <span className="text-sm font-medium text-gray-700">Document Type Name *</span>
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
                        const val = e.target.value.replace(/[{}]/g, '');
                        setConfig({...config, prefix: val});
                        if (validationErrors.prefix) {
                          setValidationErrors(prev => ({...prev, prefix: undefined}));
                        }
                      }}
                      className={`mt-1 block w-full rounded-md shadow-sm p-2 border bg-white text-slate-900 ${
                        validationErrors.prefix ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <p className="mt-1 text-xs text-gray-500">Short code only (e.g. JE-, PV-). For format templates, use the Number Format field below.</p>
                    {validationErrors.prefix && (
                      <p className="mt-1 text-sm text-red-600">❌ {validationErrors.prefix}</p>
                    )}
                  </label>
                </div>

                {/* Number Format */}
                <div className="mt-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Number Format <span className="text-gray-400 font-normal">(optional)</span></span>
                    <input 
                      type="text" 
                      value={config.numberFormat || ''} 
                      onChange={e => setConfig({...config, numberFormat: e.target.value || undefined})}
                      placeholder="{PREFIX}-{COUNTER:4}"
                      className="mt-1 block w-full rounded-md shadow-sm p-2 border border-gray-300 bg-white text-slate-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave blank for default format. Placeholders: <code className="bg-gray-100 px-1 rounded">{'{PREFIX}'}</code> <code className="bg-gray-100 px-1 rounded">{'{YYYY}'}</code> <code className="bg-gray-100 px-1 rounded">{'{COUNTER:4}'}</code>
                    </p>
                  </label>
                  {/* Live Preview */}
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Preview</span>
                    <span className="font-mono text-sm font-bold text-indigo-700">
                      {(() => {
                        const prefix = (config.prefix || 'V-').replace(/-$/, '');
                        const year = new Date().getFullYear();
                        const counter = '0042';
                        const fmt = config.numberFormat;
                        if (fmt) {
                          return fmt
                            .replace('{PREFIX}', prefix)
                            .replace('{YYYY}', String(year))
                            .replace('{COUNTER:4}', counter)
                            .replace('{COUNTER}', counter);
                        }
                        return `${prefix}-${counter}`;
                      })()}
                    </span>
                  </div>
                </div>
                
                {/* Multi-line Toggle */}
                <div 
                  onClick={() => setConfig({...config, isMultiLine: !config.isMultiLine})} 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    config.isMultiLine 
                      ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                      : 'border-gray-200 bg-white hover:border-indigo-200'
                  }`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${config.isMultiLine ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                         <Layers size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 leading-none mb-1">Enable Line Items Table</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                          {config.isMultiLine ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                   </div>
                   <div className={`w-10 h-5 rounded-full relative transition-colors ${config.isMultiLine ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                     <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.isMultiLine ? 'left-6' : 'left-1'}`} />
                   </div>
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
        const allPossibleFields = [...systemFields, ...availableFields];
        const relevantFields = allPossibleFields.filter(f => {
          if (f.supportedTypes && config.baseType && !f.supportedTypes.includes(config.baseType)) return false;
          if (f.excludedTypes && config.baseType && f.excludedTypes.includes(config.baseType)) return false;
          return true;
        });

        const renderFieldCard = (field: any, isTableCol: boolean = false) => {
          const isSelected = isTableCol 
            ? (config.tableColumns || []).some((c: any) => (typeof c === 'string' ? c : c.id) === field.id)
            : selectedFieldIds.includes(field.id);
          
          return (
            <div 
              key={field.id} 
              onClick={() => {
                if (isFieldMandatory(field.id, config.baseType) && isSelected) return;
                if (isTableCol) {
                  let updated;
                  if (isSelected) {
                    updated = (config.tableColumns || []).filter((c: any) => (typeof c === 'string' ? c : c.id) !== field.id);
                  } else {
                    updated = [...(config.tableColumns || []), { id: field.id, labelOverride: field.label }];
                  }
                  setConfig({...config, tableColumns: updated});
                } else {
                  setSelectedFieldIds(prev => isSelected ? prev.filter(f => f !== field.id) : [...prev, field.id]);
                }
              }} 
              className={`
                p-1.5 px-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all shadow-sm
                ${isSelected 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-300'
                }
              `}
            >
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[10px] font-bold truncate">{field.label}</span>
                    {isFieldMandatory(field.id, config.baseType) && (
                      <span className={`text-[7px] px-1 py-0.5 rounded font-black uppercase tracking-tighter shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>Req</span>
                    )}
                  </div>
                  <span className={`text-[8px] leading-none ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>
                    {field.id === 'lineItems' ? 'Main Table' : (field.sectionHint || (isTableCol ? 'COLUMN' : 'HEADER'))}
                  </span>
               </div>
               <div className="flex items-center shrink-0 ml-1.5">
                 {isSelected ? <CheckCircle2 size={12} className="text-white" /> : <div className="w-3 h-3 rounded-full border border-gray-200" />}
               </div>
            </div>
          );
        };

        const toggleSection = (section: string) => {
          setExpandedSections(prev => 
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
          );
        };

        const renderSection = (id: string, title: string, icon: any, fields: any[], color: string, isTableCol: boolean = false) => {
          const isExpanded = expandedSections.includes(id);
          if (fields.length === 0) return null;

          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-3">
              <button 
                onClick={() => toggleSection(id)}
                className="w-full flex items-center justify-between p-2.5 px-4 hover:bg-gray-50 transition-colors"
                id={`field-section-toggle-${id}`}
              >
                <div className="flex items-center gap-2">
                   <div className={`p-1.5 rounded-lg ${color} text-white shadow-sm shadow-black/5`}>
                      {React.createElement(icon, { size: 12 })}
                   </div>
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{title}</h3>
                   <span className="text-[10px] text-gray-400 font-bold ml-2">/ {fields.length}</span>
                </div>
                {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              </button>
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-gray-50/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pt-4">
                    {fields.map(f => renderFieldCard(f, isTableCol))}
                  </div>
                </div>
              )}
            </div>
          );
        };

        const systemList = relevantFields.filter(f => f.category === 'systemMetadata' || f.autoManaged);
        const requiredList = relevantFields.filter(f => isFieldMandatory(f.id, config.baseType) && !systemList.includes(f));
        const optionalList = relevantFields.filter(f => !isFieldMandatory(f.id, config.baseType) && !systemList.includes(f));

        return (
          <div className="max-w-6xl mx-auto py-2">
             {renderSection('system', 'System Fields', Shield, systemList, 'bg-slate-500')}
             {renderSection('required', 'Required Fields', CheckCircle2, requiredList, 'bg-blue-600')}
             {renderSection('optional', 'Optional & Shared Fields', Layers, optionalList, 'bg-indigo-600')}
             {renderSection('columns', 'Table Columns', Sliders, availableTableColumns, 'bg-emerald-600', true)}

             <div className="mt-8 pt-6 border-t border-gray-100">
               <p className="text-[10px] text-gray-400 text-center uppercase tracking-[0.2em] font-black">
                 Labels and ordering are managed in the <span className="text-indigo-600 underline underline-offset-4">Visual Editor</span> step.
               </p>
             </div>
          </div>
        );
      case 5: // Actions
        return (
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-4">
             {config.actions.map(action => (
               <div key={action.type} className={`p-4 rounded-lg border ${action.enabled ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200'}`}>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-2"
                    onClick={() => setConfig(prev => ({...prev, actions: prev.actions.map(a => a.type === action.type ? { ...a, enabled: !a.enabled } : a)}))}
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{action.label}</h4>
                      <p className="text-xs text-gray-500">{action.enabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${action.enabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                      {action.enabled && <Check size={14} />}
                    </div>
                  </div>
                  
                  {action.enabled && (
                    <div className="pt-3 mt-3 border-t border-indigo-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">Display as Icon Only (Compact)</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfig(prev => ({...prev, actions: prev.actions.map(a => a.type === action.type ? { ...a, isCompact: !a.isCompact } : a)}));
                        }}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${action.isCompact ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${action.isCompact ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )}
               </div>
             ))}
          </div>
        );
      case 6: // Visual Editor
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
               <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Step:</span>
                  <span className="text-xs font-black text-indigo-600 uppercase">Visual Layout Designer</span>
               </div>
            </div>
            {renderVisualEditor()}
          </div>
        );
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
                    <GenericVoucherRenderer 
                      definition={config as any} 
                      mode={previewMode} 
                      isPreview={true} 
                      onAction={(actionId) => {
                        if (actionId === 'save') {
                          alert('Test Run Success: Document validation passed! This voucher would be Post-Ready.');
                        } else {
                          alert(`Preview: Action [${actionId}] triggered.`);
                        }
                      }}
                    />
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg"><LayoutTemplate size={20} /></div>
            <div>
               <h1 className="text-lg font-bold text-slate-800 leading-tight flex items-center gap-2">
                 Document Wizard 
                 {currentStep > 1 && config.name && config.name !== 'New Document Form' && (
                    <>
                       <span className="text-gray-300 font-normal">/</span>
                       <span className="text-indigo-600">{config.name}</span>
                    </>
                 )}
               </h1>
            </div>
         </div>
         <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
      </div>

      {/* Read-only Warning Banner */}
      {isReadOnly && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="font-semibold">⚠️ Read Only:</span>
            <span className="text-sm">This is a system default document. Use the Clone button to create a customizable version.</span>
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
