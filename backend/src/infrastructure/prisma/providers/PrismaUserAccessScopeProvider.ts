/**
 * PrismaUserAccessScopeProvider
 * 
 * Prisma-based implementation of IUserAccessScopeProvider.
 * Reads user access scope from SQL database via Prisma.
 * 
 * Storage location: user_preferences table
 * 
 * Safe defaults:
 * - Missing preferences → empty allowedUnitIds (denies restricted accounts)
 * - Missing fields → empty allowedUnitIds, isSuper = false
 */
import { PrismaClient } from '@prisma/client';
import { IUserAccessScopeProvider } from '../../accounting/access/IUserAccessScopeProvider';
import { UserAccessScope } from '../../../domain/accounting/policies/UserAccessTypes';

export class PrismaUserAccessScopeProvider implements IUserAccessScopeProvider {
  constructor(private prisma: PrismaClient) {}

  async getScope(userId: string, companyId: string): Promise<UserAccessScope> {
    try {
      const prefs = await this.prisma.userPreferences.findUnique({
        where: { userId },
      });

      if (!prefs) {
        return this.getDefaultScope();
      }

      const data = prefs as any;

      // Extract allowedUnitIds from notificationCategoryOverrides or other custom fields
      // Since the SQL schema doesn't have a dedicated allowedUnitIds field,
      // we store it in notificationCategoryOverrides as a JSON field
      const overrides = data.notificationCategoryOverrides as any;
      const allowedUnitIds = overrides?.allowedUnitIds ?? [];
      const isSuper = overrides?.isSuper ?? false;

      return {
        allowedUnitIds: Array.isArray(allowedUnitIds) ? allowedUnitIds : [],
        isSuper: !!isSuper
      };
    } catch (error) {
      console.error(`Failed to load user scope for ${userId}:`, error);
      // Fail safe: deny restricted access
      return this.getDefaultScope();
    }
  }

  private getDefaultScope(): UserAccessScope {
    return {
      allowedUnitIds: [],
      isSuper: false
    };
  }
}
