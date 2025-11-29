
import * as admin from 'firebase-admin';
import { ImpersonationSession } from '../../../domain/impersonation/ImpersonationSession';

export class ImpersonationMapper {
  static toDomain(data: any): ImpersonationSession {
    return new ImpersonationSession(
      data.id,
      data.superAdminId,
      data.companyId,
      data.active,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.endedAt?.toDate?.() || undefined
    );
  }

  static toPersistence(entity: ImpersonationSession): any {
    return {
      id: entity.id,
      superAdminId: entity.superAdminId,
      companyId: entity.companyId,
      active: entity.active,
      createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
      endedAt: entity.endedAt ? admin.firestore.Timestamp.fromDate(entity.endedAt) : null
    };
  }
}
