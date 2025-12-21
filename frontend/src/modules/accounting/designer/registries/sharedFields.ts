/**
 * SHARED Fields Registry
 * Optional fields common across voucher types
 */

import { FieldDefinition } from '../types/FieldTypes';

export const SHARED_FIELDS: FieldDefinition[] = [
  {
    id: 'description',
    name: 'description',
    label: 'Description',
    type: 'TEXTAREA',
    category: 'SHARED',
    required: false,
    width: 'full',
    placeholder: 'Enter transaction details...'
  },
  {
    id: 'attachments',
    name: 'attachments',
    label: 'Attachments',
    type: 'TEXT',
    category: 'SHARED',
    required: false,
    width: 'full'
  },
  {
    id: 'payment_method',
    name: 'paymentMethod',
    label: 'Payment Method',
    type: 'SELECT',
    category: 'SHARED',
    required: false,
    width: '1/2'
  },
  {
    id: 'additional_notes',
    name: 'additionalNotes',
    label: 'Additional Notes',
    type: 'TEXTAREA',
    category: 'SHARED',
    required: false,
    width: 'full'
  },
  {
    id: 'cost_center',
    name: 'costCenter',
    label: 'Cost Center',
    type: 'RELATION',
    category: 'SHARED',
    required: false,
    width: '1/2'
  },
  {
    id: 'project',
    name: 'project',
    label: 'Project',
    type: 'RELATION',
    category: 'SHARED',
    required: false,
    width: '1/2'
  }
];

export function getSharedFields(): FieldDefinition[] {
  return SHARED_FIELDS;
}
