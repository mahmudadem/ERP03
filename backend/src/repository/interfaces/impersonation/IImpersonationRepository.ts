
import { ImpersonationSession } from '../../../domain/impersonation/ImpersonationSession';

export interface IImpersonationRepository {
  startSession(superAdminId: string, companyId: string): Promise<ImpersonationSession>;
  getSession(sessionId: string): Promise<ImpersonationSession | null>;
  endSession(sessionId: string): Promise<void>;
  getActiveSessionBySuperAdmin(superAdminId: string): Promise<ImpersonationSession | null>;
}
