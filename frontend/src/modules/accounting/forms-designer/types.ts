import React from 'react';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';

/**
 * Forms Designer Types
 * 
 * MIGRATED TO CANONICAL SCHEMA V2
 * 
 * Legacy types removed:
 * - VoucherTypeConfig (replaced with canonical VoucherTypeDefinition)
 * - VoucherRule (business logic, not persisted)
 * - VoucherAction (UI concern, not persisted)
 * 
 * Canonical VoucherTypeDefinition is the ONLY persisted model.
 */

// Re-export canonical type directly from engine to avoid local clash
export type { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';

// Window management (UI only)
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

// Journal UI (UI only)

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

// UI Layout helpers (UI only, not persisted)
export type UIMode = 'classic' | 'windows';
export type SectionType = 'HEADER' | 'BODY' | 'EXTRA' | 'ACTIONS' | string;

export interface FieldLayout {
  fieldId: string;
  row: number;
  col: number; // 0-11
  colSpan: number; // 1-12
  labelOverride?: string;
}

export interface SectionLayout {
  order: number;
  fields: FieldLayout[];
}

export interface VoucherLayoutConfig {
  sections: Record<string, SectionLayout>;
}

export interface AvailableField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'table' | 'textarea' | 'system';
  sectionHint?: SectionType;
}

/**
 * Migration metadata
 * Attached to VoucherTypeDefinition during migration
 */
export interface MigrationMetadata {
  migratedAt: string;
  migratedFrom: 'ai-designer-legacy';
  requiresPostingReview: true;
  postingClassificationStatus: 'unclassified';
}