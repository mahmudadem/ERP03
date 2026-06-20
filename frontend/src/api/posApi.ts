/**
 * posApi.ts — Frontend API client for the POS module.
 *
 * All endpoints sit under `/tenant/pos/...`. The backend module mount
 * (PosModule) auto-registers behind `companyModuleGuard('pos')`.
 */
import client from './client';

export type PosPaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
export type PosCashRounding = 'none' | 'nearest_05' | 'nearest_1';
export type PosRegisterStatus = 'ACTIVE' | 'INACTIVE';
export type PosShiftStatus = 'OPEN' | 'CLOSED' | 'FORCE_CLOSED' | 'CANCELLED';

export interface PosPaymentMethodDTO {
  code: PosPaymentMethodCode;
  settlementAccountId: string;
  label?: string;
  requiresReference: boolean;
  allowsChange: boolean;
  isEnabled: boolean;
}

export interface PosSettingsDTO {
  companyId: string;
  requireOpenShift: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  receiptPrefix: string;
  receiptNextSeq: number;
  cashRounding: PosCashRounding;
  allowPosDirectSales: boolean;
  paymentMethods: PosPaymentMethodDTO[];
}

export interface PosRegisterDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  cashDrawerAccountId: string;
  status: PosRegisterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PosShiftDTO {
  id: string;
  companyId: string;
  registerId: string;
  cashierUserId: string;
  status: PosShiftStatus;
  openedAt: string;
  openingFloat: number;
  closedAt?: string;
  expectedCash?: number;
  countedCash?: number;
  overShortAmount?: number;
  overShortVoucherId?: string;
  createdAt: string;
  updatedAt: string;
}

const ok = <T>(p: Promise<{ data: { success: boolean; data: T } | T }>): Promise<T> =>
  p.then((r: any) => (r?.data?.data !== undefined ? r.data.data : r.data));

export const posApi = {
  initializePos: async (): Promise<PosSettingsDTO> =>
    ok(client.post('/tenant/pos/initialize', {})),

  getSettings: async (): Promise<PosSettingsDTO | null> =>
    ok(client.get('/tenant/pos/settings')),

  updateSettings: async (payload: Partial<PosSettingsDTO>): Promise<PosSettingsDTO> =>
    ok(client.put('/tenant/pos/settings', payload)),

  listRegisters: async (): Promise<PosRegisterDTO[]> =>
    ok(client.get('/tenant/pos/registers')),

  getRegister: async (id: string): Promise<PosRegisterDTO> =>
    ok(client.get(`/tenant/pos/registers/${encodeURIComponent(id)}`)),

  createRegister: async (payload: Partial<PosRegisterDTO>): Promise<PosRegisterDTO> =>
    ok(client.post('/tenant/pos/registers', payload)),

  updateRegister: async (id: string, payload: Partial<PosRegisterDTO>): Promise<PosRegisterDTO> =>
    ok(client.put(`/tenant/pos/registers/${encodeURIComponent(id)}`, payload)),
};

export default posApi;
