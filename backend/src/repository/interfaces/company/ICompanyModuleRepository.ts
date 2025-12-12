import { CompanyModule } from '../../../domain/company/entities/CompanyModule';

/**
 * Repository interface for CompanyModule operations
 */
export interface ICompanyModuleRepository {
  /**
   * Get a specific module installation record
   */
  get(companyId: string, moduleCode: string): Promise<CompanyModule | null>;

  /**
   * List all installed modules for a company
   */
  listByCompany(companyId: string): Promise<CompanyModule[]>;

  /**
   * Create a new module installation record
   */
  create(module: CompanyModule): Promise<void>;

  /**
   * Update an existing module installation record
   */
  update(companyId: string, moduleCode: string, updates: Partial<CompanyModule>): Promise<void>;

  /**
   * Delete a module installation record
   */
  delete(companyId: string, moduleCode: string): Promise<void>;

  /**
   * Batch create multiple module records (for company creation)
   */
  batchCreate(modules: CompanyModule[]): Promise<void>;
}
