/**
 * CompanyModule - Domain Entity
 * Represents an installed module for a specific company with initialization state
 */

export interface CompanyModule {
  companyId: string;
  moduleCode: string;
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
      new Date(),
      false,
      'pending',
      {}
    );
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
