import { CompanyCreationSession } from '../../../domain/company-wizard';

export interface ICompanyCreationSessionRepository {
  create(session: CompanyCreationSession): Promise<void>;
  update(session: CompanyCreationSession): Promise<void>;
  getById(id: string): Promise<CompanyCreationSession | null>;
  delete(id: string): Promise<void>;
}
