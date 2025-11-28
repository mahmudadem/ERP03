
import { User } from '../../../domain/core/entities/User';

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
}
