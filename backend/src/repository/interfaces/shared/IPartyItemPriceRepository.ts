import { CostPoint } from '../../../domain/inventory/entities/Item';
import { PartyItemPrice, PartyItemPriceDirection } from '../../../domain/shared/entities/PartyItemPrice';

export interface PartyItemPriceUpsertInput {
  companyId: string;
  partyId: string;
  itemId: string;
  direction: PartyItemPriceDirection;
  pricePoint: CostPoint;
}

export interface IPartyItemPriceRepository {
  get(companyId: string, partyId: string, itemId: string): Promise<PartyItemPrice | null>;
  getMany(companyId: string, partyId: string, itemIds: string[]): Promise<PartyItemPrice[]>;
  upsertLastPrice(input: PartyItemPriceUpsertInput, transaction?: unknown): Promise<void>;
}
