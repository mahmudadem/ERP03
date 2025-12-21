/**
 * SYSTEM Metadata Fields Registry
 * Read-only system-managed fields
 */

import { FieldDefinition } from '../types/FieldTypes';

export const SYSTEM_FIELDS: FieldDefinition[] = [
  {
    id: 'status',
    name: 'status',
    label: 'Status',
    type: 'TEXT',
    category: 'SYSTEM',
    required: false,
    readOnly: true,
    width: '1/4'
  },
  {
    id: 'document_number',
    name: 'documentNumber',
    label: 'Document Number',
    type: 'TEXT',
    category: 'SYSTEM',
    required: false,
    readOnly: true,
    width: '1/2'
  },
  {
    id: 'created_date',
    name: 'createdDate',
    label: 'Created Date',
    type: 'DATE',
    category: 'SYSTEM',
    required: false,
    readOnly: true,
    width: '1/2'
  },
  {
    id: 'created_by',
    name: 'createdBy',
    label: 'Created By',
    type: 'RELATION',
    category: 'SYSTEM',
    required: false,
    readOnly: true,
    width: '1/2'
  },
  {
    id: 'updated_date',
    name: 'updatedDate',
    label: 'Updated Date',
    type: 'DATE',
    category: 'SYSTEM',
    required: false,
    readOnly: true,
    width: '1/2'
  },
  {
    id: 'updated_by',
    name: 'updatedBy',
    label: 'Updated By',
    type: 'RELATION',
    category: 'SYSTEM',
    required: false,
    readOnly: true,
    width: '1/2'
  }
];

export function getSystemFields(): FieldDefinition[] {
  return SYSTEM_FIELDS;
}
