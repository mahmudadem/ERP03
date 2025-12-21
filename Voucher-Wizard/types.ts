import React from 'react';

export interface WindowState {
  id: string;
  title: string;
  component: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface JournalRow {
  id: number;
  account: string;
  notes: string;
  debit: number;
  credit: number;
  currency: string;
  parity: number;
  equivalent: number;
  category: string;
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  TRY = 'Turkish Lira',
  GBP = 'GBP'
}

// --- Voucher Designer Types (V2 Wizard) ---

export type UIMode = 'classic' | 'windows';
export type SectionType = 'HEADER' | 'BODY' | 'EXTRA' | 'ACTIONS' | string;

export interface FieldLayout {
  fieldId: string;
  row: number;
  col: number; // 0-11
  colSpan: number; // 1-12
  labelOverride?: string; // New: Allow renaming fields in designer
}

export interface SectionLayout {
  order: number; // For section reordering
  fields: FieldLayout[];
}

export interface VoucherLayoutConfig {
  sections: Record<string, SectionLayout>;
}

export type VoucherActionType = 'print' | 'email' | 'download_pdf' | 'download_excel' | 'import_csv' | 'export_json';

export interface VoucherAction {
  type: VoucherActionType;
  label: string;
  enabled: boolean;
  requiredPermission?: string;
}

export interface VoucherRule {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
}

export interface VoucherTypeConfig {
  id: string;
  name: string;
  prefix: string; // e.g., "JV-"
  startNumber: number;
  
  // Wizard Step 2: Rules
  rules: VoucherRule[];

  // Wizard Step 1: Journal Logic (Moved from Step 4)
  isMultiLine: boolean;
  defaultCurrency?: string;
  
  // Wizard Step 3: Table Configuration
  tableColumns?: string[]; // ['account', 'debit', 'credit', 'notes', 'currency', 'category']

  // Wizard Step 5: Actions
  actions: VoucherAction[];

  // Layouts (Auto-Generated)
  uiModeOverrides: {
    classic: VoucherLayoutConfig;
    windows: VoucherLayoutConfig;
  };
}

export interface AvailableField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'table' | 'textarea' | 'system';
  sectionHint?: SectionType; // For auto-placement logic
}