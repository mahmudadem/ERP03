/**
 * Document Wizard - Component Exports
 * 
 * ⚠️ PURE UI MODULE
 * This module contains NO accounting logic, schemas, or persistence.
 */

export { DocumentDesigner } from './components/DocumentDesigner';
export { DocumentFormDesigner } from './components/DocumentFormDesigner';
export { WizardProvider, useWizard } from './WizardContext';

// Services for database integration

// Validators
export * from './validators';

// Mappers (UI ↔ Canonical)

export type {
  DocumentFormConfig,
  FieldLayout,
  SectionLayout,
  DocumentLayoutConfig,
  DocumentAction,
  DocumentActionType,
  DocumentRule,
  AvailableField,
  UIMode,
  SectionType,
  FieldCategory,
  OnWizardFinish
} from './types';

export * from './services/documentDesignerService';
