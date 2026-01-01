/**
 * Forms Designer - Voucher Designer and Renderer
 * This module provides the designer component for voucher templates
 */

// Main Designer Component (includes renderer internally)
export { VoucherDesigner } from './components/VoucherDesigner';

// Main Renderer Component (used by designer)
export { GenericVoucherRenderer } from '../components/shared/GenericVoucherRenderer';

// Contexts (required by components)
export { VoucherProvider, useVouchers } from './VoucherContext';
export { LanguageProvider, useLanguage } from './LanguageContext';

// Types (only UI helper types, NOT legacy config types)
export type { VoucherTypeDefinition } from './types';
export type { UIMode, FieldLayout, SectionLayout, JournalRow } from './types';

