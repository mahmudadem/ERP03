
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
}
