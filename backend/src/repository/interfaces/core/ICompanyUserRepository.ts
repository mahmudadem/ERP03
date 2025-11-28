
import { CompanyUser } from '../../../domain/core/entities/CompanyUser';

/**
 * Interface for Company-User relationship data access.
 * Manages roles and permissions within a specific company.
 */
export interface ICompanyUserRepository {
  /**
   * Assigns a user to a company with a specific role.
   * @param userId The user ID.
   * @param companyId The company ID.
   * @param role The role code (e.g., 'ADMIN', 'MEMBER').
   */
  assignUserToCompany(userId: string, companyId: string, role: string): Promise<void>;

  /**
   * Retrieves all users associated with a company.
   * @param companyId The company ID.
   */
  getCompanyUsers(companyId: string): Promise<CompanyUser[]>;

  /**
   * Retrieves the membership details of a user for a specific company.
   * @param userId The user ID.
   * @param companyId The company ID.
   */
  getUserMembership(userId: string, companyId: string): Promise<CompanyUser | null>;
}
