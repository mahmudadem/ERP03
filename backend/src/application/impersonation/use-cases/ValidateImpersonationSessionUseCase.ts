
import { IImpersonationRepository } from '../../../repository/interfaces/impersonation/IImpersonationRepository';
import { ImpersonationSession } from '../../../domain/impersonation/ImpersonationSession';

export class ValidateImpersonationSessionUseCase {
  constructor(private impersonationRepo: IImpersonationRepository) {}

  async execute(sessionId: string): Promise<ImpersonationSession | null> {
    const session = await this.impersonationRepo.getSession(sessionId);
    
    if (!session || !session.active) {
      return null;
    }

    return session;
  }
}
