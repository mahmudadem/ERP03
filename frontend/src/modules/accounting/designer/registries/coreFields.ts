/**
 * CORE Fields Registry
 * Mandatory fields per voucher type
 */

import { FieldDefinition } from '../types/FieldTypes';

export const CORE_FIELDS: Record<string, FieldDefinition[]> = {
  // Journal Voucher
  JV: [
    {
      id: 'voucher_date',
      name: 'voucherDate',
      label: 'Voucher Date',
      type: 'DATE',
      category: 'CORE',
      required: true,
      width: '1/2'
    },
    {
      id: 'exchange_rate',
      name: 'exchangeRate',
      label: 'Exchange Rate (to base)',
      type: 'NUMBER',
      category: 'CORE',
      required: true,
      width: '1/2',
      placeholder: '1'
    },
    {
      id: 'transaction_currency',
      name: 'transactionCurrency',
      label: 'Transaction Currency',
      type: 'SELECT',
      category: 'CORE',
      required: true,
      width: '1/2'
    },
    {
      id: 'reference_document',
      name: 'referenceDocument',
      label: 'Reference Document',
      type: 'TEXT',
      category: 'CORE',
      required: false,
      width: '1/2',
      placeholder: 'mm/dd/yyyy'
    }
  ],

  // Payment Voucher
  PV: [
    {
      id: 'voucher_date',
      name: 'voucherDate',
      label: 'Voucher Date',
      type: 'DATE',
      category: 'CORE',
      required: true,
      width: '1/2'
    },
    {
      id: 'payment_method',
      name: 'paymentMethod',
      label: 'Payment Method',
      type: 'SELECT',
      category: 'CORE',
      required: true,
      width: '1/2'
    },
    {
      id: 'payee',
      name: 'payee',
      label: 'Payee',
      type: 'RELATION',
      category: 'CORE',
      required: true,
      width: 'full'
    },
    {
      id: 'amount',
      name: 'amount',
      label: 'Amount',
      type: 'NUMBER',
      category: 'CORE',
      required: true,
      width: '1/2'
    }
  ],

  // Receipt Voucher
  RV: [
    {
      id: 'voucher_date',
      name: 'voucherDate',
      label: 'Voucher Date',
      type: 'DATE',
      category: 'CORE',
      required: true,
      width: '1/2'
    },
    {
      id: 'receipt_method',
      name: 'receiptMethod',
      label: 'Receipt Method',
      type: 'SELECT',
      category: 'CORE',
      required: true,
      width: '1/2'
    },
    {
      id: 'payer',
      name: 'payer',
      label: 'Payer',
      type: 'RELATION',
      category: 'CORE',
      required: true,
      width: 'full'
    },
    {
      id: 'amount',
      name: 'amount',
      label: 'Amount',
      type: 'NUMBER',
      category: 'CORE',
      required: true,
      width: '1/2'
    }
  ]
};

export function getCoreFieldsByVoucherType(voucherCode: string): FieldDefinition[] {
  return CORE_FIELDS[voucherCode] || [];
}
