import { Party, PartyRole } from '../../../domain/shared/entities/Party';

export interface PartyListOptions {
  role?: PartyRole;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface IPartyRepository {
  create(party: Party): Promise<void>;
  update(party: Party): Promise<void>;
  getById(companyId: string, id: string): Promise<Party | null>;
  getByCode(companyId: string, code: string): Promise<Party | null>;
  list(companyId: string, opts?: PartyListOptions): Promise<Party[]>;
  delete(companyId: string, id: string): Promise<void>;
}
