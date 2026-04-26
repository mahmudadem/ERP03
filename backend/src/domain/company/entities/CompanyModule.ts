/**
 * CompanyModule - Domain Entity
 * Represents an installed module for a specific company with initialization state
 * isEnabled: true means company admin has turned this module ON (enabled state)
 * isEnabled: false means company admin has turned this module OFF (disabled state)
 */

export interface CompanyModule {
  companyId: string;
  moduleCode: string;
  isEnabled: boolean;
  installedAt: Date;
  initialized: boolean;
  initializationStatus: 'pending' | 'in_progress' | 'complete';
  config: Record<string, any>;
  updatedAt?: Date;
}

export class CompanyModuleEntity implements CompanyModule {
  constructor(
    public companyId: string,
    public moduleCode: string,
    public isEnabled: boolean,
    public installedAt: Date,
    public initialized: boolean,
    public initializationStatus: 'pending' | 'in_progress' | 'complete',
    public config: Record<string, any> = {},
    public updatedAt?: Date
  ) {}

  static create(companyId: string, moduleCode: string): CompanyModuleEntity {
    return new CompanyModuleEntity(
      companyId,
      moduleCode,
      true,
      new Date(),
      false,
      'pending',
      {}
    );
  }

  disable(): void {
    this.isEnabled = false;
    this.updatedAt = new Date();
  }

  enable(): void {
    this.isEnabled = true;
    this.updatedAt = new Date();
  }

  markInitialized(config: Record<string, any> = {}): void {
    this.initialized = true;
    this.initializationStatus = 'complete';
    this.config = { ...this.config, ...config };
    this.updatedAt = new Date();
  }

  startInitialization(): void {
    this.initializationStatus = 'in_progress';
    this.updatedAt = new Date();
  }
}
