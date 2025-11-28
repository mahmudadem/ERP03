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
  static toDomain(data: any): Company {
    return new Company(
      data.id,
      data.name,
      data.ownerId,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      data.baseCurrency,
      data.fiscalYearStart?.toDate?.() || new Date(data.fiscalYearStart),
      data.fiscalYearEnd?.toDate?.() || new Date(data.fiscalYearEnd),
      data.modules || [],
      data.taxId,
      data.address
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
      fiscalYearStart: admin.firestore.Timestamp.fromDate(entity.fiscalYearStart),
      fiscalYearEnd: admin.firestore.Timestamp.fromDate(entity.fiscalYearEnd),
      modules: entity.modules,
      createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(entity.updatedAt),
    };
  }
}

export class UserMapper {
  static toDomain(data: any): User {
    return new User(
      data.id,
      data.email,
      data.name,
      data.role,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.pictureUrl
    );
  }

  static toPersistence(entity: User): any {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      role: entity.role,
      createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
      pictureUrl: entity.pictureUrl || null
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
      data.permissions || []
    );
  }

  static toPersistence(entity: CompanyUser): any {
    return {
      id: entity.id,
      userId: entity.userId,
      companyId: entity.companyId,
      role: entity.role,
      permissions: entity.permissions
    };
  }
}