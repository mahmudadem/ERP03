/**
 * Journal Entry Field Registry
 * 
 * Defines CORE and SHARED fields for Journal Entry vouchers.
 * Aligns with JournalEntryHandler from ADR-005 backend.
 */

import { VoucherTypeFieldRegistry } from '../types/SystemFieldRegistry';
import { createCoreField, createSharedField } from '../types/FieldDefinitionV2';

/**
 * Journal Entry System Fields
 * 
 * CORE fields match JournalEntryHandler requirements:
 * - date
 * - description
 * - lines (user provides debit/credit breakdown)
 * - currency (optional)
 * 
 * Note: Journal Entry is special - it has a LINES table
 * instead of fixed account fields.
 */
export const JOURNAL_ENTRY_REGISTRY: VoucherTypeFieldRegistry = {
  voucherType: 'JOURNAL_ENTRY',
  
  // ═══════════════════════════════════════════════════════════
  // CORE FIELDS (Required by JournalEntryHandler)
  // ═══════════════════════════════════════════════════════════
  coreFields: [
    createCoreField({
      id: 'date',
      dataKey: 'date',
      label: 'Entry Date',
      type: 'DATE',
      semanticMeaning: 'Date of journal entry',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'description',
      dataKey: 'description',
      label: 'Description',
      type: 'TEXTAREA',
      semanticMeaning: 'Journal entry description/explanation',
      required: true,
      width: 'full'
    }),
    
    createCoreField({
      id: 'currency',
      dataKey: 'currency',
      label: 'Transaction Currency',
      type: 'SELECT',
      semanticMeaning: 'Currency for all lines in this entry',
      required: false,
      width: '1/4'
    }),
    
    // Note: 'lines' is handled separately in the Lines Area
    // It's not a regular field but a table structure
  ],
  
  // ═══════════════════════════════════════════════════════════
  // SHARED FIELDS (Optional, system-defined)
  // ═══════════════════════════════════════════════════════════
  sharedFields: [
    createSharedField({
      id: 'exchangeRate',
      dataKey: 'exchangeRate',
      label: 'Exchange Rate (to Base)',
      type: 'NUMBER',
      semanticMeaning: 'Exchange rate if foreign currency',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'referenceDocument',
      dataKey: 'referenceDocument',
      label: 'Reference Document',
      type: 'TEXT',
      semanticMeaning: 'External document reference',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'documentNumber',
      dataKey: 'documentNumber',
      label: 'Document Number',
      type: 'TEXT',
      semanticMeaning: 'External document number',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'paymentMethod',
      dataKey: 'paymentMethod',
      label: 'Payment Method',
      type: 'SELECT',
      semanticMeaning: 'Payment method if applicable',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'periodEndDate',
      dataKey: 'periodEndDate',
      label: 'Period End Date',
      type: 'DATE',
      semanticMeaning: 'Accounting period end date',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'reversalDate',
      dataKey: 'reversalDate',
      label: 'Reversal Date',
      type: 'DATE',
      semanticMeaning: 'Date to auto-reverse this entry',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'notes',
      dataKey: 'notes',
      label: 'Internal Notes',
      type: 'TEXTAREA',
      semanticMeaning: 'Internal notes for accounting team',
      required: false,
      width: 'full'
    })
  ]
};

/**
 * Journal Entry Line Table Columns
 * 
 * These are the columns in the lines table.
 * Not part of header fields, but part of the Lines Area.
 */
export const JOURNAL_ENTRY_LINE_COLUMNS = [
  {
    id: 'account',
    dataKey: 'accountId',
    label: 'Account',
    type: 'RELATION' as const,
    semanticMeaning: 'General ledger account',
    required: true,
    category: 'CORE' as const
  },
  {
    id: 'debit',
    dataKey: 'debit',
    label: 'Debit',
    type: 'NUMBER' as const,
    semanticMeaning: 'Debit amount (0 if credit)',
    required: false,
    category: 'CORE' as const
  },
  {
    id: 'credit',
    dataKey: 'credit',
    label: 'Credit',
    type: 'NUMBER' as const,
    semanticMeaning: 'Credit amount (0 if debit)',
    required: false,
    category: 'CORE' as const
  },
  {
    id: 'notes',
    dataKey: 'notes',
    label: 'Notes',
    type: 'TEXT' as const,
    semanticMeaning: 'Line item notes',
    required: false,
    category: 'SHARED' as const
  },
  {
    id: 'costCenter',
    dataKey: 'costCenterId',
    label: 'Cost Center',
    type: 'RELATION' as const,
    semanticMeaning: 'Cost center allocation',
    required: false,
    category: 'SHARED' as const
  }
];
