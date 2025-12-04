/**
 * ICompanyAdminRepository
 * Aggregate interface for company admin operations
 */

import { Company } from '../../../domain/core/entities/Company';
import { CompanyUser } from '../../../domain/rbac/CompanyUser';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';

export interface UserInvitation {
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}

export interface Invitation {
  invitationId: string;
  email: string;
  roleId: string;
  status: string;
  invitedAt: Date;
  expiresAt: Date;
}

export interface ICompanyAdminRepository {
  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================
  
  /**
   * Updates company profile information
   */
  updateProfile(companyId: string, updates: Partial<Company>): Promise<Company>;
  
  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================
  
  /**
   * Gets all users in a company
   */
  getCompanyUsers(companyId: string): Promise<CompanyUser[]>;
  
  /**
   * Invites a new user to the company
   */
  inviteUser(companyId: string, invitation: UserInvitation): Promise<Invitation>;
  
  /**
   * Updates a user's role in the company
   */
  updateUserRole(companyId: string, userId: string, roleId: string): Promise<CompanyUser>;
  
  /**
   * Disables a user's access to the company
   */
  disableUser(companyId: string, userId: string): Promise<void>;
  
  /**
   * Re-enables a user's access to the company
   */
  enableUser(companyId: string, userId: string): Promise<void>;
  
  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================
  
  /**
   * Gets all roles in a company
   */
  getRoles(companyId: string): Promise<CompanyRole[]>;
  
  /**
   * Creates a new role in the company
   */
  createRole(role: CompanyRole): Promise<CompanyRole>;
  
  /**
   * Updates an existing role
   */
  updateRole(companyId: string, roleId: string, updates: Partial<CompanyRole>): Promise<CompanyRole>;
  
  /**
   * Deletes a role from the company
   */
  deleteRole(companyId: string, roleId: string): Promise<void>;
  
  // ============================================================================
  // MODULE MANAGEMENT
  // ============================================================================
  
  /**
   * Gets available modules for a bundle
   */
  getAvailableModules(bundleId: string): Promise<string[]>;
  
  /**
   * Enables a module for the company
   */
  enableModule(companyId: string, moduleName: string): Promise<void>;
  
  /**
   * Disables a module for the company
   */
  disableModule(companyId: string, moduleName: string): Promise<void>;
  
  // ============================================================================
  // BUNDLE MANAGEMENT
  // ============================================================================
  
  /**
   * Upgrades company to a new bundle
   */
  upgradeBundle(companyId: string, bundleId: string): Promise<Company>;
  
  // ============================================================================
  // FEATURE FLAG MANAGEMENT
  // ============================================================================
  
  /**
   * Gets available features for a bundle
   */
  getAvailableFeatures(bundleId: string): Promise<string[]>;
  
  /**
   * Toggles a feature flag for the company
   */
  toggleFeature(companyId: string, featureName: string, enabled: boolean): Promise<void>;
}
