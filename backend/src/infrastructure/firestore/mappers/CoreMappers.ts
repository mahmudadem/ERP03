/**
 * CoreMappers.ts
 * 
 * Purpose:
 * Transforms plain Firestore objects into rich Domain Entities and vice-versa.
 * Decouples the Domain layer from persistence details (e.g. Timestamp objects).
 */
import * as admin from 'firebase-admin';
import { Company } from '../../../domain/core/entities/Company';
import { User } from '../../../domain/core/entities/User';
import { CompanyUser } from '../../../domain/core/entities/CompanyUser';

export class CompanyMapper {
  private static toTimestamp(date: Date | number) {
    const d = typeof date === 'number' ? new Date(date) : date;
    if (admin?.firestore?.Timestamp) {
      return admin.firestore.Timestamp.fromDate(d);
    }
    // Fallback to plain Date if Timestamp is unavailable
    return d;
  }

  static toDomain(data: any): Company {
    const fiscalYearStart = (typeof data.fiscalYearStart === 'number' && data.fiscalYearStart <= 12) 
        ? data.fiscalYearStart 
        : (data.fiscalYearStart?.toDate?.() || new Date(data.fiscalYearStart));

    const fiscalYearEnd = (typeof data.fiscalYearEnd === 'number' && data.fiscalYearEnd <= 12)
        ? data.fiscalYearEnd
        : (data.fiscalYearEnd?.toDate?.() || new Date(data.fiscalYearEnd));

    return new Company(
      data.id,
      data.name,
      data.ownerId,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      data.baseCurrency,
      fiscalYearStart,
      fiscalYearEnd,
      data.modules || [],
      data.features || [],
      data.taxId,
      data.subscriptionPlan,
      data.address,
      data.country,
      data.logoUrl,
      data.contactInfo
    );
  }

  static toPersistence(entity: Company): any {
    return {
      id: entity.id,
      name: entity.name,
      ownerId: entity.ownerId,
      taxId: entity.taxId,
      address: entity.address || null,
      baseCurrency: entity.baseCurrency,
      fiscalYearStart: typeof entity.fiscalYearStart === 'number' ? entity.fiscalYearStart : this.toTimestamp(entity.fiscalYearStart),
      fiscalYearEnd: typeof entity.fiscalYearEnd === 'number' ? entity.fiscalYearEnd : this.toTimestamp(entity.fiscalYearEnd),
      modules: entity.modules,
      features: entity.features,
      subscriptionPlan: entity.subscriptionPlan || null,
      createdAt: this.toTimestamp(entity.createdAt),
      updatedAt: this.toTimestamp(entity.updatedAt),
      country: entity.country || null,
      logoUrl: entity.logoUrl || null,
      contactInfo: entity.contactInfo || null
    };
  }
}

export class UserMapper {
  private static toTimestamp(date: Date) {
    if (admin?.firestore?.Timestamp) {
      return admin.firestore.Timestamp.fromDate(date);
    }
    return date;
  }

  static toDomain(data: any): User {
    return new User(
      data.id,
      data.email,
      data.name,
      data.globalRole || data.role || 'USER',
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.pictureUrl,
      data.planId,
      data.activeCompanyId
    );
  }

  static toPersistence(entity: User): any {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      globalRole: entity.globalRole,
      createdAt: this.toTimestamp(entity.createdAt),
      pictureUrl: entity.pictureUrl || null,
      planId: entity.planId || null,
      activeCompanyId: entity.activeCompanyId || null
    };
  }
}

export class CompanyUserMapper {
  static toDomain(data: any): CompanyUser {
    return new CompanyUser(
      data.id,
      data.userId,
      data.companyId,
      data.role,
      data.permissions || [],
      data.isDisabled || false
    );
  }

  static toPersistence(entity: CompanyUser): any {
    return {
      id: entity.id,
      userId: entity.userId,
      companyId: entity.companyId,
      role: entity.role,
      permissions: entity.permissions,
      isDisabled: entity.isDisabled
    };
  }
}
