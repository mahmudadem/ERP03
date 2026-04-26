/**
 * CapabilityRegistry - Domain Entity
 * 
 * Represents a feature/capability within a module that can be optionally enabled.
 */
export interface CapabilityRegistry {
  id: string;
  code: string;
  moduleId: string;
  name: string;
  description?: string;
  lifecycleStatus: 'draft' | 'ready' | 'deprecated' | 'inactive';
  runtimeStatus: 'available' | 'suspended';
  implementationStatus: 'unchecked' | 'passed' | 'failed';
  implementationError?: string;
  implementationCheckedAt?: Date;
  enablementPolicy: 'platform_only' | 'bundle_entitled' | 'company_admin_optional';
  requiresMigration: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyCapability {
  companyId: string;
  capabilityId: string;
  isEnabled: boolean;
  config: Record<string, any>;
  enabledAt?: Date;
  disabledAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export class CompanyCapabilityEntity implements CompanyCapability {
  constructor(
    public companyId: string,
    public capabilityId: string,
    public isEnabled: boolean,
    public config: Record<string, any> = {},
    public enabledAt?: Date,
    public disabledAt?: Date,
    public createdAt: Date = new Date(),
    public updatedAt?: Date
  ) {}

  static create(companyId: string, capabilityId: string): CompanyCapabilityEntity {
    return new CompanyCapabilityEntity(
      companyId,
      capabilityId,
      false,
      {},
      undefined,
      undefined,
      new Date()
    );
  }

  enable(): void {
    this.isEnabled = true;
    this.enabledAt = new Date();
    this.updatedAt = new Date();
  }

  disable(): void {
    this.isEnabled = false;
    this.disabledAt = new Date();
    this.updatedAt = new Date();
  }
}