import client from './client';

export interface MessagingAccountDTO {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'TELEGRAM';
  provider: 'META_WHATSAPP_CLOUD' | 'SMTP' | 'TELEGRAM_BOT';
  label: string;
  isDefault?: boolean;
  isActive?: boolean;
  phoneNumberE164?: string;
  phoneNumberId?: string;
  fromAddress?: string;
  fromDisplayName?: string;
  botUsername?: string;
  apiVersion?: string;
  hasCredential?: boolean;
  credential?: string;
}

export interface CommunicationsSettingsDTO {
  companyId: string;
  messagingAccounts: MessagingAccountDTO[];
}

// The response interceptor (errorInterceptor.ts) already unwraps the
// { success, data } envelope, so `client.get/put` resolves to the inner
// payload directly. The defensive `?.data?.data ?? ?.data ?? r` chain keeps
// this correct even if the interceptor is bypassed for a given call.
export const communicationsApi = {
  async getSettings(): Promise<CommunicationsSettingsDTO> {
    const r: any = await client.get('/tenant/communications/settings');
    return (r?.data?.data ?? r?.data ?? r) as CommunicationsSettingsDTO;
  },

  async updateSettings(data: Partial<CommunicationsSettingsDTO>): Promise<CommunicationsSettingsDTO> {
    const r: any = await client.put('/tenant/communications/settings', data);
    return (r?.data?.data ?? r?.data ?? r) as CommunicationsSettingsDTO;
  },
};
