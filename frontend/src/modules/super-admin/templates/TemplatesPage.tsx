import { useQuery } from '@tanstack/react-query';
import { superAdminTemplatesApi, WizardTemplateSummary, CoaTemplateSummary, CurrencySummary } from '../../../api/superAdminTemplates';
import { useTranslation } from 'react-i18next';

export default function TemplatesPage() {
  const { t } = useTranslation('common');
  const wizardQuery = useQuery({
    queryKey: ['super-admin', 'wizard-templates'],
    queryFn: async () => (await superAdminTemplatesApi.listWizardTemplates()) as unknown as WizardTemplateSummary[],
  });

  const coaQuery = useQuery({
    queryKey: ['super-admin', 'coa-templates'],
    queryFn: async () => (await superAdminTemplatesApi.listCoaTemplates()) as unknown as CoaTemplateSummary[],
  });

  const currencyQuery = useQuery({
    queryKey: ['super-admin', 'currencies'],
    queryFn: async () => (await superAdminTemplatesApi.listCurrencies()) as unknown as CurrencySummary[],
  });

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('superAdmin.templates.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('superAdmin.templates.subtitle')}</p>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('superAdmin.templates.sections.wizardTemplates')}</h2>
        <TemplateCard
          loading={wizardQuery.isLoading}
          error={wizardQuery.error as any}
          data={wizardQuery.data}
          t={t}
          columns={[
            { header: t('superAdmin.templates.columns.name'), render: (r) => r.name },
            { header: t('superAdmin.templates.columns.models'), render: (r) => (r.models || []).join(', ') || '-' },
            { header: t('superAdmin.templates.columns.id'), render: (r) => r.id },
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('superAdmin.templates.sections.coaTemplates')}</h2>
        <TemplateCard
          loading={coaQuery.isLoading}
          error={coaQuery.error as any}
          data={coaQuery.data}
          t={t}
          columns={[
            { header: t('superAdmin.templates.columns.name'), render: (r) => r.name },
            { header: t('superAdmin.templates.columns.id'), render: (r) => r.id },
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('superAdmin.templates.sections.currencies')}</h2>
        <TemplateCard
          loading={currencyQuery.isLoading}
          error={currencyQuery.error as any}
          data={currencyQuery.data}
          t={t}
          columns={[
            { header: t('superAdmin.templates.columns.code'), render: (r) => r.id },
            { header: t('superAdmin.templates.columns.name'), render: (r) => r.name },
          ]}
        />
      </section>
    </div>
  );
}

type Column<T> = { header: string; render: (row: T) => React.ReactNode };

function TemplateCard<T>({ loading, error, data, columns, t }: { loading: boolean; error: any; data: T[] | undefined; columns: Column<T>[]; t: (key: string, options?: any) => string }) {
  if (loading) return <div className="text-sm text-gray-500">{t('superAdmin.templates.loading')}</div>;
  if (error) return <div className="text-sm text-red-600">{t('superAdmin.templates.loadFailed', { message: error?.message || t('superAdmin.templates.unknownError') })}</div>;
  const rows = data || [];

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td key={c.header} className="px-4 py-2 text-sm text-gray-800">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-4 text-sm text-gray-500 text-center">
                {t('superAdmin.templates.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
