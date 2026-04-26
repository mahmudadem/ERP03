/**
 * ModuleDefinition.ts
 * 
 * System-wide module definition managed by Super Admin.
 * Examples: finance, inventory, hr
 * Note: "core" and "companyAdmin" are NOT modules
 */

export type LifecycleStatus = 'draft' | 'ready' | 'deprecated' | 'inactive';
export type RuntimeStatus = 'available' | 'suspended';
export type ImplementationStatus = 'unchecked' | 'passed' | 'failed';

export interface ModuleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  version: string;
  lifecycleStatus: LifecycleStatus;
  runtimeStatus: RuntimeStatus;
  implementationStatus: ImplementationStatus;
  implementationError?: string;
  implementationCheckedAt?: Date;
  releaseNotes?: string;
  dependencies: string[];
  businessDomainId?: string;
  createdAt: Date;
  updatedAt: Date;
}
