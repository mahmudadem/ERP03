/**
 * Receipt Voucher Field Registry
 * 
 * Defines CORE and SHARED fields for Receipt vouchers.
 * Aligns with ReceiptVoucherHandler from ADR-005 backend.
 */

import { VoucherTypeFieldRegistry } from '../types/SystemFieldRegistry';
import { createCoreField, createSharedField } from '../types/FieldDefinitionV2';

/**
 * Receipt Voucher System Fields
 * 
 * CORE fields match ReceiptVoucherHandler requirements:
 * - date
 * - amount
 * - bankAccountId (bank account to debit - where money goes)
 * - revenueAccountId (revenue account to credit - income source)
 * - description
 * - currency
 */
export const RECEIPT_VOUCHER_REGISTRY: VoucherTypeFieldRegistry = {
  voucherType: 'RECEIPT',
  
  // ═══════════════════════════════════════════════════════════
  // CORE FIELDS (Required by ReceiptVoucherHandler)
  // ═══════════════════════════════════════════════════════════
  coreFields: [
    createCoreField({
      id: 'date',
      dataKey: 'date',
      label: 'Receipt Date',
      type: 'DATE',
      semanticMeaning: 'Date when payment was received',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'amount',
      dataKey: 'amount',
      label: 'Amount',
      type: 'NUMBER',
      semanticMeaning: 'Receipt amount',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'bankAccountId',
      dataKey: 'bankAccountId',
      label: 'Bank Account',
      type: 'RELATION',
      semanticMeaning: 'Account to debit (where money is received)',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'revenueAccountId',
      dataKey: 'revenueAccountId',
      label: 'Revenue Account',
      type: 'RELATION',
      semanticMeaning: 'Account to credit (income category)',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'description',
      dataKey: 'description',
      label: 'Description',
      type: 'TEXTAREA',
      semanticMeaning: 'Receipt description/purpose',
      required: true,
      width: 'full'
    }),
    
    createCoreField({
      id: 'currency',
      dataKey: 'currency',
      label: 'Currency',
      type: 'SELECT',
      semanticMeaning: 'Transaction currency',
      required: false,
      width: '1/4'
    })
  ],
  
  // ═══════════════════════════════════════════════════════════
  // SHARED FIELDS (Optional, system-defined)
  // ═══════════════════════════════════════════════════════════
  sharedFields: [
    createSharedField({
      id: 'salesInvoiceNo',
      dataKey: 'salesInvoiceNo',
      label: 'Sales Invoice No',
      type: 'TEXT',
      semanticMeaning: 'Reference to sales invoice being paid',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'customerReference',
      dataKey: 'customerReference',
      label: 'Customer Reference',
      type: 'TEXT',
      semanticMeaning: 'Customer account number or reference',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'receiptMethod',
      dataKey: 'receiptMethod',
      label: 'Receipt Method',
      type: 'SELECT',
      semanticMeaning: 'How payment was received (cash, check, wire, card, etc.)',
      required: false,
      width: '1/2'
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
      id: 'transactionId',
      dataKey: 'transactionId',
      label: 'Transaction ID',
      type: 'TEXT',
      semanticMeaning: 'Bank transaction/confirmation ID',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'checkNumber',
      dataKey: 'checkNumber',
      label: 'Check Number',
      type: 'TEXT',
      semanticMeaning: 'Check number if payment by check',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'costCenterId',
      dataKey: 'costCenterId',
      label: 'Cost Center',
      type: 'RELATION',
      semanticMeaning: 'Cost center for revenue allocation',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'projectId',
      dataKey: 'projectId',
      label: 'Project',
      type: 'RELATION',
      semanticMeaning: 'Project for revenue tracking',
      required: false,
      width: '1/2'
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
