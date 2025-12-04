
import { User, UserRole } from '../../../domain/core/entities/User';

/**
 * Interface for User data access.
 * Handles user identity and profile management.
 */
export interface IUserRepository {
  /**
   * Retrieves a user by their ID.
   * @param userId The user ID.
   */
  getUserById(userId: string): Promise<User | null>;

  /**
   * Creates a new user.
   * @param user The user entity.
   */
  createUser(user: User): Promise<void>;

  /**
   * Updates an existing user's profile.
   * @param userId The ID of the user to update.
   * @param data Partial data to update.
   */
  updateUser(userId: string, data: Partial<User>): Promise<void>;

  /**
   * Updates a user's global role (SUPER_ADMIN or USER).
   * @param userId The ID of the user.
   * @param newRole The new global role.
   */
  updateGlobalRole(userId: string, newRole: UserRole): Promise<void>;

  /**
   * Updates the user's active company.
   * @param userId The ID of the user.
   * @param companyId The ID of the company to set as active.
   */
  updateActiveCompany(userId: string, companyId: string): Promise<void>;

  /**
   * Finds a user by their email address.
   * @param email The user's email.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Retrieves the user's active company id if set.
   */
  getUserActiveCompany(userId: string): Promise<string | null>;
}
