import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Bot,
  Building2,
  Coins,
  FileText,
  Palette,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Workflow,
} from 'lucide-react';

const settingsGroups = [
  {
    id: 'general',
    icon: SlidersHorizontal,
    links: [
      { id: 'company', path: '/company-admin/settings', icon: Building2 },
      { id: 'appearance', path: '/settings/appearance', icon: Palette },
      { id: 'notifications', path: '/settings/notifications', icon: Bell },
    ],
  },
  {
    id: 'workflow',
    icon: Workflow,
    links: [
      { id: 'approval', path: '/settings/approval', icon: ShieldCheck },
      { id: 'sales', path: '/sales/settings', icon: ReceiptText },
      { id: 'purchases', path: '/purchases/settings', icon: FileText },
    ],
  },
  {
    id: 'finance',
    icon: Coins,
    links: [
      { id: 'accounting', path: '/accounting/settings', icon: Coins },
      { id: 'inventory', path: '/inventory/settings', icon: FileText },
      { id: 'taxCodes', path: '/settings/tax-codes', icon: ReceiptText },
      { id: 'currencies', path: '/system/currencies', icon: Coins },
    ],
  },
  {
    id: 'access',
    icon: UserCog,
    links: [
      { id: 'roles', path: '/settings/rbac/roles', icon: ShieldCheck },
      { id: 'assignUsers', path: '/settings/rbac/users', icon: UserCog },
      { id: 'ai', path: '/ai-assistant/settings', icon: Bot },
    ],
  },
];

const SettingsHomePage: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-full bg-gray-50 p-4 dark:bg-[var(--color-bg-primary)] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b border-gray-200 pb-5 dark:border-[var(--color-border)]">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
            {t('settings.home.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-[var(--color-text-secondary)]">
            {t('settings.home.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {settingsGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <section
                key={group.id}
                className="rounded-lg border border-gray-200 bg-white p-5 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]"
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/10 dark:text-primary-400">
                    <GroupIcon size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">
                      {t(`settings.home.groups.${group.id}.title`)}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
                      {t(`settings.home.groups.${group.id}.description`)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  {group.links.map((link) => {
                    const LinkIcon = link.icon;
                    return (
                      <Link
                        key={link.id}
                        to={link.path}
                        className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition-colors hover:border-indigo-100 hover:bg-indigo-50/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:border-primary-500/30 dark:hover:bg-[var(--color-bg-tertiary)]"
                      >
                        <LinkIcon
                          size={18}
                          aria-hidden="true"
                          className="text-gray-400 group-hover:text-indigo-600 dark:text-[var(--color-text-muted)] dark:group-hover:text-primary-400"
                        />
                        <span className="font-medium text-gray-800 dark:text-[var(--color-text-primary)]">
                          {t(`settings.home.links.${link.id}.title`)}
                        </span>
                        <span className="ms-auto text-xs text-gray-400 dark:text-[var(--color-text-muted)]">
                          {t('settings.home.open')}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SettingsHomePage;
