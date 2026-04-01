import client from './client';

export type PartyRole = 'VENDOR' | 'CUSTOMER';
export type TaxType = 'VAT' | 'GST' | 'EXEMPT' | 'ZERO_RATED';
export type TaxScope = 'PURCHASE' | 'SALES' | 'BOTH';

export interface PartyDTO {
  id: string;
  companyId: string;
  code: string;
  legalName: string;
  displayName: string;
  roles: PartyRole[];
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  defaultCurrency?: string;
  defaultAPAccountId?: string;
  defaultARAccountId?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxCodeDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  scope: TaxScope;
  purchaseTaxAccountId?: string;
  salesTaxAccountId?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const sharedApi = {
  createParty: (payload: Partial<PartyDTO>): Promise<PartyDTO> =>
    client.post('/tenant/shared/parties', payload),

  updateParty: (id: string, payload: Partial<PartyDTO>): Promise<PartyDTO> =>
    client.put(`/tenant/shared/parties/${id}`, payload),

  getParty: (id: string): Promise<PartyDTO> =>
    client.get(`/tenant/shared/parties/${id}`),

  listParties: (opts?: { role?: PartyRole; active?: boolean }): Promise<PartyDTO[]> =>
    client.get('/tenant/shared/parties', { params: opts }),

  createTaxCode: (payload: Partial<TaxCodeDTO>): Promise<TaxCodeDTO> =>
    client.post('/tenant/shared/tax-codes', payload),

  updateTaxCode: (id: string, payload: Partial<TaxCodeDTO>): Promise<TaxCodeDTO> =>
    client.put(`/tenant/shared/tax-codes/${id}`, payload),

  getTaxCode: (id: string): Promise<TaxCodeDTO> =>
    client.get(`/tenant/shared/tax-codes/${id}`),

  listTaxCodes: (opts?: { scope?: TaxScope; active?: boolean }): Promise<TaxCodeDTO[]> =>
    client.get('/tenant/shared/tax-codes', { params: opts }),
};
