export type MessagingChannel = 'WHATSAPP' | 'EMAIL' | 'TELEGRAM';
export type MessagingProvider = 'META_WHATSAPP_CLOUD' | 'SMTP' | 'TELEGRAM_BOT';

export interface MessagingAccount {
  id: string;
  channel: MessagingChannel;
  provider: MessagingProvider;
  label: string;
  isDefault?: boolean;
  isActive?: boolean;
  phoneNumberE164?: string;
  phoneNumberId?: string;
  fromAddress?: string;
  fromDisplayName?: string;
  botUsername?: string;
  apiVersion?: string;
  encryptedCredential?: string;
}

export interface CommunicationsSettingsProps {
  companyId: string;
  messagingAccounts?: MessagingAccount[];
}

export class CommunicationsSettings {
  readonly companyId: string;
  messagingAccounts: MessagingAccount[];

  constructor(props: CommunicationsSettingsProps) {
    if (!props.companyId?.trim()) throw new Error('CommunicationsSettings companyId is required');
    this.companyId = props.companyId;

    const raw = (props.messagingAccounts ?? [])
      .filter((a) => !!a?.id && !!a?.channel && !!a?.provider && !!a?.label)
      .map((a) => ({
        id: String(a.id).trim(),
        channel: a.channel,
        provider: a.provider,
        label: String(a.label).trim(),
        isDefault: a.isDefault ?? false,
        isActive: a.isActive ?? true,
        phoneNumberE164: a.phoneNumberE164?.trim() || undefined,
        phoneNumberId: a.phoneNumberId?.trim() || undefined,
        fromAddress: a.fromAddress?.trim() || undefined,
        fromDisplayName: a.fromDisplayName?.trim() || undefined,
        botUsername: a.botUsername?.trim() || undefined,
        apiVersion: a.apiVersion?.trim() || undefined,
        encryptedCredential: a.encryptedCredential?.trim() || undefined,
      }));

    const byChannel = new Map<MessagingChannel, MessagingAccount[]>();
    for (const a of raw) {
      const list = byChannel.get(a.channel) ?? [];
      list.push(a);
      byChannel.set(a.channel, list);
    }

    this.messagingAccounts = [];
    byChannel.forEach((accounts) => {
      const active = accounts.filter((a) => a.isActive !== false);
      const explicitDefault = active.find((a) => a.isDefault);
      const defaultId = explicitDefault?.id ?? active[0]?.id;
      for (const a of accounts) {
        this.messagingAccounts.push({ ...a, isDefault: a.id === defaultId, isActive: a.isActive !== false });
      }
    });
  }

  static createDefault(companyId: string): CommunicationsSettings {
    return new CommunicationsSettings({ companyId, messagingAccounts: [] });
  }

  toJSON(): Record<string, unknown> {
    return {
      companyId: this.companyId,
      messagingAccounts: this.messagingAccounts,
    };
  }

  static fromJSON(data: any): CommunicationsSettings {
    return new CommunicationsSettings({
      companyId: data.companyId,
      messagingAccounts: data.messagingAccounts ?? [],
    });
  }
}
