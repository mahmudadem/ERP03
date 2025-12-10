/**
 * BusinessDomainDefinition.ts
 * 
 * Represents a business domain that can be associated with bundles.
 * Examples: "Food Trading", "Restaurant", "Clothing Trading"
 */

export interface BusinessDomainDefinition {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
