import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle,
  Send,
  Mail,
  Plus,
  Trash2,
  Star,
  ChevronDown,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Inbox,
} from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { Badge } from '../../../components/ui/Badge';
import { communicationsApi, MessagingAccountDTO } from '../../../api/communicationsApi';
import { errorHandler } from '../../../services/errorHandler';
import toast from 'react-hot-toast';

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Channel = MessagingAccountDTO['channel'];

interface ChannelDef {
  id: Channel;
  label: string;
  provider: MessagingAccountDTO['provider'];
  icon: React.ElementType;
  chip: string;
}

const CHANNELS: ChannelDef[] = [
  {
    id: 'WHATSAPP',
    label: 'WhatsApp',
    provider: 'META_WHATSAPP_CLOUD',
    icon: MessageCircle,
    chip: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
  },
  {
    id: 'TELEGRAM',
    label: 'Telegram',
    provider: 'TELEGRAM_BOT',
    icon: Send,
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  },
  {
    id: 'EMAIL',
    label: 'Email',
    provider: 'SMTP',
    icon: Mail,
    chip: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-primary-400',
  },
];

const CommunicationsSettingsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [accounts, setAccounts] = useState<MessagingAccountDTO[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCred, setShowCred] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await communicationsApi.getSettings();
      setAccounts(data.messagingAccounts ?? []);
      setCredentials({});
      setDirty(false);
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDirty = () => setDirty(true);

  const update = (id: string, patch: Partial<MessagingAccountDTO>) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    markDirty();
  };

  const add = (def: ChannelDef) => {
    const id = newId();
    const hasDefault = accounts.some((a) => a.channel === def.id && a.isActive !== false && a.isDefault);
    setAccounts((prev) => [
      ...prev,
      {
        id,
        channel: def.id,
        provider: def.provider,
        label: '',
        isDefault: !hasDefault,
        isActive: true,
        phoneNumberE164: '',
        phoneNumberId: '',
        fromAddress: '',
        fromDisplayName: '',
        botUsername: '',
        apiVersion: def.id === 'WHATSAPP' ? 'v22.0' : undefined,
        hasCredential: false,
      },
    ]);
    setExpanded((prev) => ({ ...prev, [id]: true }));
    markDirty();
  };

  const remove = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setCredentials((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    markDirty();
  };

  const toggleDefault = (id: string, channel: Channel, makeDefault: boolean) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.channel === channel ? { ...a, isDefault: makeDefault && a.id === id } : a
      )
    );
    markDirty();
  };

  const setCredential = (id: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [id]: value }));
    markDirty();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = accounts.map((a) => ({
        ...a,
        credential: credentials[a.id]?.trim() || undefined,
      }));
      const data = await communicationsApi.updateSettings({ messagingAccounts: payload });
      setAccounts(data.messagingAccounts ?? []);
      setCredentials({});
      setDirty(false);
      toast.success(t('communications.saved', 'Communication settings saved.'));
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const isIncomplete = useCallback(
    (a: MessagingAccountDTO): boolean => {
      const hasCred = a.hasCredential || !!credentials[a.id]?.trim();
      if (a.channel === 'WHATSAPP') return !a.phoneNumberId?.trim() || !hasCred;
      if (a.channel === 'EMAIL') return !a.fromAddress?.trim() || !hasCred;
      return !hasCred;
    },
    [credentials]
  );

  const identifier = (a: MessagingAccountDTO): string => {
    if (a.channel === 'WHATSAPP') return a.phoneNumberE164?.trim() || a.phoneNumberId?.trim() || '—';
    if (a.channel === 'TELEGRAM') return a.botUsername?.trim() ? `@${a.botUsername.trim()}` : '—';
    return a.fromAddress?.trim() || '—';
  };

  const totalConfigured = useMemo(
    () => accounts.filter((a) => !isIncomplete(a) && a.isActive !== false).length,
    [accounts, isIncomplete]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400 dark:text-[var(--color-text-muted)]">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[var(--color-bg-primary)]">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]/90">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
              {t('communications.title', 'Communications')}
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-[var(--color-text-secondary)]">
              {t(
                'communications.subtitle',
                'Manage the messaging channels used to send documents to customers. Shared across all modules.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {t('communications.unsaved', 'Unsaved changes')}
              </span>
            )}
            <Button onClick={handleSave} isLoading={saving} disabled={!dirty || saving}>
              {t('common.saveChanges', 'Save Changes')}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {/* Zero-setup callout */}
        <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-500/20 dark:bg-teal-500/5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-teal-800 dark:text-teal-300">
              {t('communications.shareLink.title', 'No setup needed to share invoices')}
            </p>
            <p className="mt-1 text-teal-700 dark:text-teal-200/80">
              {t(
                'communications.shareLink.description',
                'The "Share via WhatsApp" button on any posted invoice opens a pre-filled message on your phone or WhatsApp Web — no account required. Configure the channels below only if you want documents sent automatically, server-side.'
              )}
            </p>
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
          {t('communications.summary', {
            defaultValue: '{{count}} active channel ready to send',
            defaultValue_plural: '{{count}} active channels ready to send',
            count: totalConfigured,
          })}
        </p>

        {/* Channel sections */}
        {CHANNELS.map((def) => {
          const Icon = def.icon;
          const list = accounts.filter((a) => a.channel === def.id);
          return (
            <section
              key={def.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]"
            >
              <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${def.chip}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">
                      {t(`communications.channel.${def.id}.title`, `${def.label}`)}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-muted)]">
                        {list.length}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
                      {t(`communications.channel.${def.id}.description`, channelHint(def.id))}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => add(def)}
                >
                  {t('communications.add', 'Add')}
                </Button>
              </header>

              <div className="p-3">
                {list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-6 py-8 text-center dark:border-[var(--color-border)]">
                    <Inbox className="h-6 w-6 text-gray-300 dark:text-[var(--color-text-muted)]" aria-hidden="true" />
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-muted)]">
                      {t('communications.noChannelAccounts', {
                        defaultValue: 'No {{channel}} accounts yet.',
                        channel: def.label,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => add(def)}
                      className="cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      {t('communications.addFirst', { defaultValue: 'Add a {{channel}} account', channel: def.label })}
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {list.map((account) => {
                      const isOpen = !!expanded[account.id];
                      const incomplete = isIncomplete(account);
                      const inactive = account.isActive === false;
                      return (
                        <li
                          key={account.id}
                          className="rounded-lg border border-gray-200 bg-white dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                        >
                          {/* Summary row */}
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <button
                              type="button"
                              aria-label={account.isDefault ? t('communications.isDefault', 'Default sender') : t('communications.setDefault', 'Set as default sender')}
                              aria-pressed={account.isDefault === true}
                              onClick={() => toggleDefault(account.id, account.channel, !account.isDefault)}
                              className="shrink-0 cursor-pointer rounded p-1 text-gray-300 hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:text-[var(--color-text-muted)]"
                            >
                              <Star
                                className={`h-4 w-4 ${account.isDefault ? 'fill-amber-400 text-amber-400' : ''}`}
                                aria-hidden="true"
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpanded((p) => ({ ...p, [account.id]: !p[account.id] }))}
                              aria-expanded={isOpen}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-gray-900 dark:text-[var(--color-text-primary)]">
                                  {account.label?.trim() || t('communications.untitledAccount', 'Untitled account')}
                                </span>
                                <span className="block truncate text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
                                  {identifier(account)}
                                </span>
                              </span>

                              <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                                {account.isDefault && <Badge variant="info">{t('communications.default', 'Default')}</Badge>}
                                {inactive ? (
                                  <Badge variant="default">{t('communications.inactive', 'Inactive')}</Badge>
                                ) : incomplete ? (
                                  <Badge variant="warning">{t('communications.needsSetup', 'Needs setup')}</Badge>
                                ) : (
                                  <Badge variant="success">{t('communications.ready', 'Ready')}</Badge>
                                )}
                              </span>

                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-[var(--color-text-muted)] ${isOpen ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                              />
                            </button>

                            <button
                              type="button"
                              aria-label={t('common.remove', 'Remove')}
                              onClick={() => remove(account.id)}
                              className="shrink-0 cursor-pointer rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:text-[var(--color-text-muted)] dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>

                          {/* Expanded editor */}
                          {isOpen && (
                            <div className="space-y-4 border-t border-gray-100 p-4 dark:border-[var(--color-border)]">
                              {def.id === 'WHATSAPP' && incomplete && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                  <div>
                                    <p className="font-semibold">{t('communications.whatsappSetupHint.title', 'Where to get WhatsApp API credentials')}</p>
                                    <ol className="mt-1 list-inside list-decimal space-y-0.5">
                                      <li>{t('communications.whatsappSetupHint.step1', 'developers.facebook.com → My Apps → Create App → Business.')}</li>
                                      <li>{t('communications.whatsappSetupHint.step2', 'Add WhatsApp → Set up. Meta provides a free test number.')}</li>
                                      <li>{t('communications.whatsappSetupHint.step3', 'Copy the Phone Number ID and access token from the API Setup page.')}</li>
                                      <li>{t('communications.whatsappSetupHint.step4', 'For production, generate a permanent System User token.')}</li>
                                    </ol>
                                  </div>
                                </div>
                              )}

                              <div className="grid gap-4 sm:grid-cols-2">
                                <Input
                                  label={t('communications.field.label', 'Account label')}
                                  value={account.label || ''}
                                  onChange={(e) => update(account.id, { label: e.target.value })}
                                  placeholder={def.label}
                                />

                                {def.id === 'WHATSAPP' && (
                                  <>
                                    <Input
                                      label={t('communications.field.phoneDisplay', 'Display phone (E.164)')}
                                      type="tel"
                                      value={account.phoneNumberE164 || ''}
                                      onChange={(e) => update(account.id, { phoneNumberE164: e.target.value })}
                                      placeholder="+15551234567"
                                    />
                                    <Input
                                      label={t('communications.field.phoneNumberId', 'Meta phone number ID')}
                                      required
                                      value={account.phoneNumberId || ''}
                                      onChange={(e) => update(account.id, { phoneNumberId: e.target.value })}
                                    />
                                    <Input
                                      label={t('communications.field.apiVersion', 'API version')}
                                      value={account.apiVersion || ''}
                                      onChange={(e) => update(account.id, { apiVersion: e.target.value })}
                                      placeholder="v22.0"
                                    />
                                  </>
                                )}

                                {def.id === 'EMAIL' && (
                                  <>
                                    <Input
                                      label={t('communications.field.fromAddress', 'From email')}
                                      required
                                      type="email"
                                      value={account.fromAddress || ''}
                                      onChange={(e) => update(account.id, { fromAddress: e.target.value })}
                                      placeholder="billing@company.com"
                                    />
                                    <Input
                                      label={t('communications.field.fromName', 'From name')}
                                      value={account.fromDisplayName || ''}
                                      onChange={(e) => update(account.id, { fromDisplayName: e.target.value })}
                                    />
                                  </>
                                )}

                                {def.id === 'TELEGRAM' && (
                                  <Input
                                    label={t('communications.field.botUsername', 'Bot username')}
                                    value={account.botUsername || ''}
                                    onChange={(e) => update(account.id, { botUsername: e.target.value })}
                                    placeholder="my_company_bot"
                                  />
                                )}

                                <Input
                                  label={t('communications.field.credential', 'Credential / access token')}
                                  type={showCred[account.id] ? 'text' : 'password'}
                                  value={credentials[account.id] || ''}
                                  onChange={(e) => setCredential(account.id, e.target.value)}
                                  autoComplete="new-password"
                                  rightIcon={
                                    <button
                                      type="button"
                                      aria-label={showCred[account.id] ? t('communications.hideCredential', 'Hide credential') : t('communications.showCredential', 'Show credential')}
                                      onClick={() => setShowCred((p) => ({ ...p, [account.id]: !p[account.id] }))}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--color-text-primary)]"
                                    >
                                      {showCred[account.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  }
                                  hint={
                                    account.hasCredential
                                      ? t('communications.field.credentialStored', 'A credential is stored. Leave blank to keep it.')
                                      : t('communications.field.credentialRequired', 'Required to send automatically.')
                                  }
                                />
                              </div>

                              <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-[var(--color-border)]">
                                <ToggleSwitch
                                  label={t('communications.field.active', 'Active')}
                                  checked={account.isActive !== false}
                                  onChange={(checked) => update(account.id, { isActive: checked })}
                                />
                                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">
                                  <input
                                    type="radio"
                                    name={`default-${account.channel}`}
                                    checked={account.isDefault === true}
                                    onChange={() => toggleDefault(account.id, account.channel, true)}
                                    className="h-4 w-4 accent-amber-500"
                                  />
                                  {t('communications.field.default', 'Default for this channel')}
                                </label>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

function channelHint(channel: Channel): string {
  if (channel === 'WHATSAPP') return 'Send invoices via the Meta WhatsApp Cloud API.';
  if (channel === 'TELEGRAM') return 'Send invoices through a Telegram bot.';
  return 'Send invoices by email (SMTP).';
}

export default CommunicationsSettingsPage;
