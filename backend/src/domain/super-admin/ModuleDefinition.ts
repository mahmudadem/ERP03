/**
 * ModuleDefinition.ts
 * 
 * System-wide module definition managed by Super Admin.
 * Examples: finance, inventory, hr
 * Note: "core" and "companyAdmin" are NOT modules
 */

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
