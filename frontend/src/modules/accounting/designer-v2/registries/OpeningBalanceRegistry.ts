/**
 * Opening Balance Field Registry
 * 
 * Defines CORE and SHARED fields for Opening Balance vouchers.
 * Aligns with OpeningBalanceHandler from ADR-005 backend.
 */

import { VoucherTypeFieldRegistry } from '../types/SystemFieldRegistry';
import { createCoreField, createSharedField } from '../types/FieldDefinitionV2';

/**
 * Opening Balance System Fields
 * 
 * CORE fields match OpeningBalanceHandler requirements:
 * - date (opening balance as of date)
 * - description
 * - lines (user provides account balances)
 * 
 * Similar to Journal Entry but with specific purpose.
 */
export const OPENING_BALANCE_REGISTRY: VoucherTypeFieldRegistry = {
  voucherType: 'OPENING_BALANCE',
  
  // ═══════════════════════════════════════════════════════════
  // CORE FIELDS (Required by OpeningBalanceHandler)
  // ═══════════════════════════════════════════════════════════
  coreFields: [
    createCoreField({
      id: 'date',
      dataKey: 'date',
      label: 'Opening Balance Date',
      type: 'DATE',
      semanticMeaning: 'Date of opening balances (usually fiscal year start)',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'description',
      dataKey: 'description',
      label: 'Description',
      type: 'TEXTAREA',
      semanticMeaning: 'Opening balance description',
      required: true,
      width: 'full'
    }),
    
    // Note: 'lines' is handled separately in the Lines Area
  ],
  
  // ═══════════════════════════════════════════════════════════
  // SHARED FIELDS (Optional, system-defined)
  // ═══════════════════════════════════════════════════════════
  sharedFields: [
    createSharedField({
      id: 'fiscalYearStart',
      dataKey: 'fiscalYearStart',
      label: 'Fiscal Year Start',
      type: 'DATE',
      semanticMeaning: 'Fiscal year start date',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'previousSystemReference',
      dataKey: 'previousSystemReference',
      label: 'Previous System Reference',
      type: 'TEXT',
      semanticMeaning: 'Reference to previous accounting system',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'migrationDate',
      dataKey: 'migrationDate',
      label: 'Migration Date',
      type: 'DATE',
      semanticMeaning: 'Date when data was migrated from old system',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'verifiedBy',
      dataKey: 'verifiedBy',
      label: 'Verified By',
      type: 'TEXT',
      semanticMeaning: 'Who verified these opening balances',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'verificationDate',
      dataKey: 'verificationDate',
      label: 'Verification Date',
      type: 'DATE',
      semanticMeaning: 'Date when balances were verified',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'notes',
      dataKey: 'notes',
      label: 'Internal Notes',
      type: 'TEXTAREA',
      semanticMeaning: 'Internal notes about the opening balances',
      required: false,
      width: 'full'
    })
  ]
};

/**
 * Opening Balance Line Table Columns
 * 
 * Similar to Journal Entry but focused on account balances.
 */
export const OPENING_BALANCE_LINE_COLUMNS = [
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
    label: 'Debit (Assets)',
    type: 'NUMBER' as const,
    semanticMeaning: 'Debit balance for assets',
    required: false,
    category: 'CORE' as const
  },
  {
    id: 'credit',
    dataKey: 'credit',
    label: 'Credit (Liab + Equity)',
    type: 'NUMBER' as const,
    semanticMeaning: 'Credit balance for liabilities and equity',
    required: false,
    category: 'CORE' as const
  },
  {
    id: 'notes',
    dataKey: 'notes',
    label: 'Notes',
    type: 'TEXT' as const,
    semanticMeaning: 'Notes about this account balance',
    required: false,
    category: 'SHARED' as const
  }
];
