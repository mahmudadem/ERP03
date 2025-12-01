/**
 * FirestoreUserRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of IUserRepository using Firestore.
 */
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IUserRepository } from '../../../../repository/interfaces/core/IUserRepository';
import { User, UserRole } from '../../../../domain/core/entities/User';
import { UserMapper } from '../../mappers/CoreMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreUserRepository extends BaseFirestoreRepository<User> implements IUserRepository {
  protected collectionName = 'users';

  protected toDomain(data: any): User {
    return UserMapper.toDomain(data);
  }

  protected toPersistence(entity: User): any {
    return UserMapper.toPersistence(entity);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.findById(userId);
  }

  async createUser(user: User): Promise<void> {
    return this.save(user);
  }

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    try {
      // Note: Partial updates typically require specific mapper handling or direct object updates.
      // For MVP, we can use Firestore's update feature directly.
      await this.db.collection(this.collectionName).doc(userId).update(data);
    } catch (error) {
      throw new InfrastructureError('Error updating user', error);
    }
  }

  async updateGlobalRole(userId: string, newRole: UserRole): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(userId).update({ globalRole: newRole });
    } catch (error) {
      throw new InfrastructureError('Error updating user global role', error);
    }
  }

  async updateActiveCompany(userId: string, companyId: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(userId).update({ activeCompanyId: companyId });
    } catch (error) {
      throw new InfrastructureError('Error updating user active company', error);
    }
  }

  async getUserActiveCompany(userId: string): Promise<string | null> {
    const doc = await this.db.collection(this.collectionName).doc(userId).get();
    if (!doc.exists) return null;
    const data = doc.data() as any;
    return data?.activeCompanyId || null;
  }
}
