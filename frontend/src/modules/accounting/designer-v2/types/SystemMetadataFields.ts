/**
 * SystemMetadataFields.ts
 * 
 * Defines system metadata fields (createdAt, updatedAt, etc.)
 * These are read-only fields that show voucher lifecycle information.
 */

import { FieldDefinitionV2, createSharedField } from './FieldDefinitionV2';

/**
 * System Metadata Field Definition
 */
export interface SystemMetadataField extends FieldDefinitionV2 {
  isSystemMetadata: true;
  metadataType: 'audit' | 'status' | 'workflow';
}

/**
 * Available System Metadata Fields
 */
export const SYSTEM_METADATA_FIELDS: SystemMetadataField[] = [
  // Audit Fields
  {
    ...createSharedField({
      id: 'createdAt',
      dataKey: 'createdAt',
      label: 'Created At',
      type: 'DATE',
      semanticMeaning: 'Timestamp when voucher was created',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'audit',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'createdBy',
      dataKey: 'createdBy',
      label: 'Created By',
      type: 'RELATION',
      semanticMeaning: 'User who created the voucher',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'audit',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'updatedAt',
      dataKey: 'updatedAt',
      label: 'Last Updated',
      type: 'DATE',
      semanticMeaning: 'Timestamp of last modification',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'audit',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'updatedBy',
      dataKey: 'updatedBy',
      label: 'Updated By',
      type: 'RELATION',
      semanticMeaning: 'User who last modified the voucher',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'audit',
    readOnly: true
  },
  
  // Status Fields
  {
    ...createSharedField({
      id: 'status',
      dataKey: 'status',
      label: 'Status',
      type: 'SELECT',
      semanticMeaning: 'Current voucher status',
      width: '1/4'
    }),
    isSystemMetadata: true,
    metadataType: 'status',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'voucherNumber',
      dataKey: 'voucherNumber',
      label: 'Voucher Number',
      type: 'TEXT',
      semanticMeaning: 'System-generated voucher number',
      width: '1/4'
    }),
    isSystemMetadata: true,
    metadataType: 'status',
    readOnly: true
  },
  
  // Workflow Fields
  {
    ...createSharedField({
      id: 'submittedAt',
      dataKey: 'submittedAt',
      label: 'Submitted At',
      type: 'DATE',
      semanticMeaning: 'When voucher was submitted for approval',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'submittedBy',
      dataKey: 'submittedBy',
      label: 'Submitted By',
      type: 'RELATION',
      semanticMeaning: 'User who submitted for approval',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'approvedAt',
      dataKey: 'approvedAt',
      label: 'Approved At',
      type: 'DATE',
      semanticMeaning: 'When voucher was approved',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'approvedBy',
      dataKey: 'approvedBy',
      label: 'Approved By',
      type: 'RELATION',
      semanticMeaning: 'User who approved the voucher',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'rejectedAt',
      dataKey: 'rejectedAt',
      label: 'Rejected At',
      type: 'DATE',
      semanticMeaning: 'When voucher was rejected',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'rejectedBy',
      dataKey: 'rejectedBy',
      label: 'Rejected By',
      type: 'RELATION',
      semanticMeaning: 'User who rejected the voucher',
      width: '1/2'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  },
  
  {
    ...createSharedField({
      id: 'rejectionReason',
      dataKey: 'rejectionReason',
      label: 'Rejection Reason',
      type: 'TEXTAREA',
      semanticMeaning: 'Why voucher was rejected',
      width: 'full'
    }),
    isSystemMetadata: true,
    metadataType: 'workflow',
    readOnly: true
  }
];

/**
 * Get metadata fields by type
 */
export function getMetadataFieldsByType(type: 'audit' | 'status' | 'workflow'): SystemMetadataField[] {
  return SYSTEM_METADATA_FIELDS.filter(f => f.metadataType === type);
}

/**
 * Get all metadata field IDs
 */
export function getAllMetadataFieldIds(): string[] {
  return SYSTEM_METADATA_FIELDS.map(f => f.id);
}

/**
 * Check if a field ID is a system metadata field
 */
export function isSystemMetadataField(fieldId: string): boolean {
  return getAllMetadataFieldIds().includes(fieldId);
}
