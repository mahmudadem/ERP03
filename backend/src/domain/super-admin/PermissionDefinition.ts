/**
 * PermissionDefinition.ts
 * 
 * System-wide permission definition managed by Super Admin.
 */

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
