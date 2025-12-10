
import { Company } from '../../../domain/core/entities/Company';

/**
 * Interface for Company data access.
 * Used by Core UseCases to manage company lifecycles and settings.
 */
export interface ICompanyRepository {
  /**
   * Persists a company entity.
   * @param company The company entity to save.
   */
  save(company: Company): Promise<void>;

  /**
   * Finds a company by its ID.
   * @param id The unique company ID.
   */
  findById(id: string): Promise<Company | null>;

  /**
   * Finds a company by its Tax ID.
   * Used for validation during creation.
   * @param taxId The tax identification number.
   */
  findByTaxId(taxId: string): Promise<Company | null>;

  /**
   * Retrieves all companies a user belongs to.
   * @param userId The user's ID.
   */
  getUserCompanies(userId: string): Promise<Company[]>;

  /**
   * Updates the module list for a company.
   * @param companyId The company ID.
   * @param moduleName The module to enable.
   */
  enableModule(companyId: string, moduleName: string): Promise<void>;

  /**
   * Updates company profile fields.
   * @param companyId The company ID.
   * @param updates Partial company data to update.
   */
  update(companyId: string, updates: Partial<Company>): Promise<Company>;

  /**
   * Disables a module for a company.
   * @param companyId The company ID.
   * @param moduleName The module to disable.
   */
  disableModule(companyId: string, moduleName: string): Promise<void>;

  /**
   * Updates the company's bundle.
   * @param companyId The company ID.
   * @param bundleId The new bundle ID.
   */
  updateBundle(companyId: string, bundleId: string): Promise<Company>;

  /**
   * Updates the company's active features.
   * @param companyId The company ID.
   * @param features Array of feature names.
   */
  updateFeatures(companyId: string, features: string[]): Promise<void>;

  /**
   * Lists all companies in the system (Super Admin only).
   */
  listAll(): Promise<Company[]>;
}
