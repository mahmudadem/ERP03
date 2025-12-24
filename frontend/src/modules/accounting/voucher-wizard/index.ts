/**
 * Voucher Wizard - Component Exports
 * 
 * ⚠️ PURE UI MODULE
 * This module contains NO accounting logic, schemas, or persistence.
 */

export { VoucherDesigner } from './components/VoucherDesigner';
export { VoucherFormDesigner } from './components/VoucherFormDesigner';
export { WizardProvider, useWizard } from './WizardContext';

// Services for database integration
export * from './services';

// Validators
export * from './validators';

// Mappers (UI ↔ Canonical)
export * from './mappers';

export type {
  VoucherFormConfig,
  FieldLayout,
  SectionLayout,
  VoucherLayoutConfig,
  VoucherAction,
  VoucherActionType,
  VoucherRule,
  AvailableField,
  UIMode,
  SectionType,
  FieldCategory,
  OnWizardFinish
} from './types';

// Backward compatibility alias for the service function is already exported via * from './services'
