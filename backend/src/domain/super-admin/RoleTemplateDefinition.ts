/**
 * RoleTemplateDefinition.ts
 * 
 * Represents a system-wide role template that can be used by companies.
 * Examples: "Admin", "Accountant", "Manager"
 */

export interface RoleTemplateDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];  // Array of permission IDs
  createdAt: Date;
  updatedAt: Date;
}
