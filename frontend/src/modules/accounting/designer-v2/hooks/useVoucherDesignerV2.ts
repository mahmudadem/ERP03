/**
 * useVoucherDesignerV2.ts
 * 
 * State management hook for the voucher designer wizard.
 * Manages step navigation, field selection, and layout configuration.
 */

import { useState, useEffect } from 'react';
import { VoucherTypeCode, DisplayMode, VoucherLayoutV2 } from '../types/VoucherLayoutV2';
import { FieldDefinitionV2 } from '../types/FieldDefinitionV2';
import { LineColumnDefinition, getDefaultLineTableConfig } from '../types/LineTableConfiguration';
import { getCoreFields, getSharedFields } from '../registries';

export type DesignerStep = 'SELECT_TYPE' | 'FIELD_SELECTION' | 'LAYOUT_EDITOR' | 'LINE_CONFIG' | 'VALIDATION' | 'REVIEW';

export interface DesignerState {
  // Step navigation
  currentStep: DesignerStep;
  
  // Voucher type selection
  voucherType?: VoucherTypeCode;
  
  // Field selection
  selectedFieldIds: string[];
  personalFields: FieldDefinitionV2[];
  
  // Field customizations (styling, labels, etc.)
  customizedFields: Map<string, Partial<FieldDefinitionV2>>;
  
  // Line table configuration
  lineColumns: LineColumnDefinition[];
  
  // Layout configuration
  displayMode: DisplayMode;
  
  // Loading state
  loading: boolean;
  error: string | null;
}

const STEP_ORDER: DesignerStep[] = [
  'SELECT_TYPE',
  'FIELD_SELECTION',
  'LINE_CONFIG',
  'LAYOUT_EDITOR',
  'VALIDATION',
  'REVIEW'
];

export const useVoucherDesignerV2 = (initialType?: VoucherTypeCode) => {
  const [state, setState] = useState<DesignerState>({
    currentStep: initialType ? 'FIELD_SELECTION' : 'SELECT_TYPE',
    voucherType: initialType,
    selectedFieldIds: [],
    personalFields: [],
    customizedFields: new Map(),
    lineColumns: getDefaultLineTableConfig().columns,
    displayMode: 'windows',
    loading: false,
    error: null
  });

  // Get all fields (CORE + selected SHARED + PERSONAL) with customizations applied
  const getAllFields = (): FieldDefinitionV2[] => {
    if (!state.voucherType) return [];

    const coreFields = getCoreFields(state.voucherType);
    const sharedFields = getSharedFields(state.voucherType);
    
    // Always include CORE fields
    const fields: FieldDefinitionV2[] = [...coreFields];
    
    // Include selected SHARED fields
    const selectedShared = sharedFields.filter(f => state.selectedFieldIds.includes(f.id));
    fields.push(...selectedShared);
    
    // Include PERSONAL fields
    fields.push(...state.personalFields);
    
    // Apply customizations to all fields
    return fields.map(field => {
      const customizations = state.customizedFields.get(field.id);
      return customizations ? { ...field, ...customizations } : field;
    });
  };

  // Initialize field selection when voucher type changes
  useEffect(() => {
    if (state.voucherType) {
      const coreFields = getCoreFields(state.voucherType);
      const coreIds = coreFields.map(f => f.id);
      
      // Auto-select all CORE fields
      setState(prev => ({
        ...prev,
        selectedFieldIds: [...coreIds, ...prev.selectedFieldIds.filter(id => !coreIds.includes(id))]
      }));
    }
  }, [state.voucherType]);

  // Select voucher type
  const selectVoucherType = (type: VoucherTypeCode) => {
    setState(prev => ({
      ...prev,
      voucherType: type
    }));
  };

  // Update field selection
  const updateFieldSelection = (fieldIds: string[], personalFields: FieldDefinitionV2[]) => {
    setState(prev => ({
      ...prev,
      selectedFieldIds: fieldIds,
      personalFields
    }));
  };

  // Update fields (from layout editor) - Store customizations
  const updateFields = (fields: FieldDefinitionV2[]) => {
    const newCustomizations = new Map(state.customizedFields);
    const coreFields = state.voucherType ? getCoreFields(state.voucherType) : [];
    const sharedFields = state.voucherType ? getSharedFields(state.voucherType) : [];
    
    // Extract PERSONAL fields (they're fully custom)
    const personalFields = fields.filter(f => f.category === 'PERSONAL');
    
    // Extract field IDs
    const fieldIds = fields.map(f => f.id);
    
    // Store customizations for CORE and SHARED fields
    fields.forEach(field => {
      if (field.category === 'CORE' || field.category === 'SHARED') {
        // Find the original field
        const originalField = [...coreFields, ...sharedFields].find(f => f.id === field.id);
        
        if (originalField) {
          // Store only the differences (customizations)
          const customizations: Partial<FieldDefinitionV2> = {};
          
          if (field.label !== originalField.label) customizations.label = field.label;
          if (field.width !== originalField.width) customizations.width = field.width;
          if (field.style) customizations.style = field.style;
          if (field.placeholder !== originalField.placeholder) customizations.placeholder = field.placeholder;
          
          // Store customizations
          if (Object.keys(customizations).length > 0) {
            newCustomizations.set(field.id, customizations);
          } else {
            newCustomizations.delete(field.id);
          }
        }
      }
    });
    
    setState(prev => ({
      ...prev,
      selectedFieldIds: fieldIds,
      personalFields,
      customizedFields: newCustomizations
    }));
  };

  // Update display mode
  const updateDisplayMode = (mode: DisplayMode) => {
    setState(prev => ({
      ...prev,
      displayMode: mode
    }));
  };

  // Set current step
  const setCurrentStep = (step: DesignerStep) => {
    setState(prev => ({
      ...prev,
      currentStep: step
    }));
  };

  // Navigate to next step
  const nextStep = () => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
    }
  };

  // Check if can proceed to next step
  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 'SELECT_TYPE':
        return !!state.voucherType;
      
      case 'FIELD_SELECTION':
        // At least CORE fields must be selected
        if (!state.voucherType) return false;
        const coreFields = getCoreFields(state.voucherType);
        return coreFields.every(f => state.selectedFieldIds.includes(f.id));
      
      case 'LINE_CONFIG':
        // Line config is optional, always can proceed
        return true;
      
      case 'LAYOUT_EDITOR':
        return getAllFields().length > 0;
      
      case 'VALIDATION':
        // Validation auto-checks, always can proceed if valid
        return true;
      
      case 'REVIEW':
        return true;
      
      default:
        return false;
    }
  };

  // Update line table columns
  const updateLineColumns = (columns: LineColumnDefinition[]) => {
    setState(prev => ({ ...prev, lineColumns: columns }));
  };

  // Save configuration
  const save = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // TODO: Call repository to save layout
      // const layout: VoucherLayoutV2 = {
      //   voucherType: state.voucherType!,
      //   mode: state.displayMode,
      //   ...
      // };
      // await userLayoutRepository.save(layout);
      
      console.log('Saving layout...', {
        voucherType: state.voucherType,
        fields: getAllFields(),
        mode: state.displayMode
      });
      
      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setState(prev => ({ ...prev, loading: false }));
      
      return true;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to save configuration'
      }));
      
      return false;
    }
  };

  // Reset designer
  const reset = () => {
    setState({
      currentStep: 'SELECT_TYPE',
      selectedFieldIds: [],
      personalFields: [],
      customizedFields: new Map(),
      lineColumns: getDefaultLineTableConfig().columns,
      displayMode: 'windows',
      loading: false,
      error: null
    });
  };

  return {
    // State
    currentStep: state.currentStep,
    voucherType: state.voucherType,
    selectedFieldIds: state.selectedFieldIds,
    personalFields: state.personalFields,
    lineColumns: state.lineColumns,
    displayMode: state.displayMode,
    loading: state.loading,
    error: state.error,
    
    // Computed
    allFields: getAllFields(),
    canProceed: canProceed(),
    
    // Actions
    selectVoucherType,
    updateFieldSelection,
    updateFields,
    updateLineColumns,
    updateDisplayMode,
    setCurrentStep,
    nextStep,
    prevStep,
    save,
    reset
  };
};
