/**
 * useVoucherDesigner.ts
 * 
 * Adapted from old designer to use V2 field types and registries
 */

import { useState, useEffect } from 'react';
import { VoucherTypeCode, DisplayMode } from '../types/VoucherLayoutV2';
import { FieldDefinitionV2 } from '../types/FieldDefinitionV2';
import { LineColumnDefinition, getDefaultLineTableConfig } from '../types/LineTableConfiguration';
import { getCoreFields, getSharedFields } from '../registries';
import { SYSTEM_METADATA_FIELDS } from '../types/SystemMetadataFields';
import { errorHandler } from '../../../../services/errorHandler';

export type DesignerStep = 'SELECT_TYPE' | 'FIELD_SELECTION' | 'LINE_CONFIG' | 'LAYOUT_EDITOR' | 'VALIDATION' | 'REVIEW';

export const STEPS: { id: DesignerStep; label: string }[] = [
  { id: 'SELECT_TYPE', label: 'Select Type' },
  { id: 'FIELD_SELECTION', label: 'Fields' },
  { id: 'LINE_CONFIG', label: 'Line Table' },
  { id: 'LAYOUT_EDITOR', label: 'Layout' },
  { id: 'VALIDATION', label: 'Validate' },
  { id: 'REVIEW', label: 'Review' }
];

export const useVoucherDesigner = (initialType?: string) => {
  const [currentStep, setCurrentStep] = useState<DesignerStep>('SELECT_TYPE');
  const [voucherType, setVoucherType] = useState<VoucherTypeCode | undefined>(initialType as VoucherTypeCode);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [personalFields, setPersonalFields] = useState<FieldDefinitionV2[]>([]);
  const [customizedFields, setCustomizedFields] = useState<Map<string, Partial<FieldDefinitionV2>>>(new Map());
  const [lineColumns, setLineColumns] = useState<LineColumnDefinition[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('windows');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize when voucher type changes
  useEffect(() => {
    if (voucherType) {
      // Auto-select all CORE fields
      const coreFields = getCoreFields(voucherType);
      const coreIds = coreFields.map(f => f.id);
      setSelectedFieldIds(prev => {
        const uniqueIds = new Set([...coreIds, ...prev]);
        return Array.from(uniqueIds);
      });

      // Initialize line columns
      if (lineColumns.length === 0) {
        setLineColumns(getDefaultLineTableConfig(voucherType));
      }
    }
  }, [voucherType]);

  // Get all fields with customizations
  const getAllFields = (): FieldDefinitionV2[] => {
    if (!voucherType) return [];

    const coreFields = getCoreFields(voucherType);
    const sharedFields = getSharedFields(voucherType);
    
    const fields: FieldDefinitionV2[] = [];
    
    // Always include CORE fields
    fields.push(...coreFields);
    
    // Include selected SHARED fields
    const selectedShared = sharedFields.filter(f => selectedFieldIds.includes(f.id));
    fields.push(...selectedShared);
    
    // Include PERSONAL fields
    fields.push(...personalFields);
    
    // Include selected SYSTEM METADATA fields
    const selectedSystemMetadata = SYSTEM_METADATA_FIELDS.filter(f => selectedFieldIds.includes(f.id));
    fields.push(...selectedSystemMetadata);
    
    // Apply customizations
    return fields.map(field => {
      const customizations = customizedFields.get(field.id);
      return customizations ? { ...field, ...customizations } as FieldDefinitionV2 : field;
    });
  };

  const selectVoucherType = (type: VoucherTypeCode) => {
    setVoucherType(type);
    nextStep();
  };

  const updateSelectedFields = (fieldIds: string[]) => {
    setSelectedFieldIds(fieldIds);
  };

  const updatePersonalFields = (fields: FieldDefinitionV2[]) => {
    setPersonalFields(fields);
  };

  const updateFields = (fields: FieldDefinitionV2[]) => {
    // Update customized fields map
    const newCustomizations = new Map(customizedFields);
    fields.forEach(field => {
      // Store any changes to the field
      newCustomizations.set(field.id, field);
    });
    setCustomizedFields(newCustomizations);
  };

  const updateLineColumns = (columns: LineColumnDefinition[]) => {
    setLineColumns(columns);
  };

  const updateDisplayMode = (mode: DisplayMode) => {
    setDisplayMode(mode);
  };

  const nextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      // TODO: Implement save to repository
      console.log('Saving voucher layout:', {
        voucherType,
        fields: getAllFields(),
        lineColumns,
        displayMode
      });
      errorHandler.showError({
        code: 'NOT_IMPLEMENTED',
        message: 'Save functionality to be implemented',
        severity: 'INFO'
      } as any);
    } catch (err: any) {
      setError(err.message);
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  };

  return {
    currentStep,
    setCurrentStep,
    designer: {
      voucherType,
      selectedFieldIds,
      personalFields,
      allFields: getAllFields(),
      lineColumns,
      displayMode,
      loading,
      error,
      selectVoucherType,
      updateSelectedFields,
      updatePersonalFields,
      updateFields,
      updateLineColumns,
      updateDisplayMode
    },
    nextStep,
    prevStep,
    save,
    steps: STEPS
  };
};
