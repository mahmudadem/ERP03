/**
 * Payment Voucher Field Registry
 * 
 * Defines CORE and SHARED fields for Payment vouchers.
 * Aligns with PaymentVoucherHandler from ADR-005 backend.
 */

import { VoucherTypeFieldRegistry } from '../types/SystemFieldRegistry';
import { createCoreField, createSharedField } from '../types/FieldDefinitionV2';

/**
 * Payment Voucher System Fields
 * 
 * CORE fields match PaymentVoucherHandler requirements:
 * - date
 * - amount
 * - cashAccountId (cash/bank account to credit)
 * - expenseAccountId (expense account to debit)
 * - description
 * - currency (optional but commonly used)
 */
export const PAYMENT_VOUCHER_REGISTRY: VoucherTypeFieldRegistry = {
  voucherType: 'PAYMENT',
  
  // ═══════════════════════════════════════════════════════════
  // CORE FIELDS (Required by PaymentVoucherHandler)
  // ═══════════════════════════════════════════════════════════
  coreFields: [
    createCoreField({
      id: 'date',
      dataKey: 'date',
      label: 'Payment Date',
      type: 'DATE',
      semanticMeaning: 'Date when payment was made',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'amount',
      dataKey: 'amount',
      label: 'Amount',
      type: 'NUMBER',
      semanticMeaning: 'Payment amount',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'cashAccountId',
      dataKey: 'cashAccountId',
      label: 'Cash/Bank Account',
      type: 'RELATION',
      semanticMeaning: 'Account to credit (source of payment)',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'expenseAccountId',
      dataKey: 'expenseAccountId',
      label: 'Expense Account',
      type: 'RELATION',
      semanticMeaning: 'Account to debit (what was paid for)',
      required: true,
      width: '1/2'
    }),
    
    createCoreField({
      id: 'description',
      dataKey: 'description',
      label: 'Description',
      type: 'TEXTAREA',
      semanticMeaning: 'Payment description/purpose',
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
      id: 'purchaseInvoiceNo',
      dataKey: 'purchaseInvoiceNo',
      label: 'Purchase Invoice No',
      type: 'TEXT',
      semanticMeaning: 'Reference to purchase invoice being paid',
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
      id: 'paymentMethod',
      dataKey: 'paymentMethod',
      label: 'Payment Method',
      type: 'SELECT',
      semanticMeaning: 'How payment was made (cash, check, wire, etc.)',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'supplierReference',
      dataKey: 'supplierReference',
      label: 'Supplier Reference',
      type: 'TEXT',
      semanticMeaning: 'Supplier account number or reference',
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
      id: 'dueDate',
      dataKey: 'dueDate',
      label: 'Due Date',
      type: 'DATE',
      semanticMeaning: 'Original due date of the bill',
      required: false,
      width: '1/4'
    }),
    
    createSharedField({
      id: 'costCenterId',
      dataKey: 'costCenterId',
      label: 'Cost Center',
      type: 'RELATION',
      semanticMeaning: 'Cost center for expense allocation',
      required: false,
      width: '1/2'
    }),
    
    createSharedField({
      id: 'projectId',
      dataKey: 'projectId',
      label: 'Project',
      type: 'RELATION',
      semanticMeaning: 'Project for expense tracking',
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
