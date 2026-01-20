
import { useQuery } from '@tanstack/react-query';
import client from '../../../api/client';

export interface PaymentMethodDefinition {
  id: string;
  name: string;
  isEnabled: boolean;
}

export interface AccountingSettings {
  financialApprovalEnabled: boolean;
  faApplyMode: 'ALL' | 'MARKED_ONLY';
  custodyConfirmationEnabled: boolean;
  autoPostEnabled: boolean;
  allowEditDeletePosted: boolean;
  periodLockEnabled: boolean;
  lockedThroughDate?: string;
  paymentMethods?: PaymentMethodDefinition[];
}

export const useAccountingSettings = () => {
  return useQuery({
    queryKey: ['accountingSettings'],
    queryFn: async () => {
      // client.get unwraps { success, data } based on interceptors
      const data = await client.get('tenant/accounting/policy-config');
      return data as unknown as AccountingSettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
