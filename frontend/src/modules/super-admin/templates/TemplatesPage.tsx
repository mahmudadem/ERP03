import { useQuery } from '@tanstack/react-query';
import { superAdminTemplatesApi, WizardTemplateSummary, CoaTemplateSummary, CurrencySummary } from '../../../api/superAdminTemplates';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';

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
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.templates.title')}
        description={t('superAdmin.templates.subtitle')}
        meta="Initialization"
      />

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-950">{t('superAdmin.templates.sections.wizardTemplates')}</h2>
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
        <h2 className="mb-3 text-base font-semibold text-slate-950">{t('superAdmin.templates.sections.coaTemplates')}</h2>
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
        <h2 className="mb-3 text-base font-semibold text-slate-950">{t('superAdmin.templates.sections.currencies')}</h2>
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
    </SuperAdminPage>
  );
}

type Column<T> = { header: string; render: (row: T) => React.ReactNode };

function TemplateCard<T>({ loading, error, data, columns, t }: { loading: boolean; error: any; data: T[] | undefined; columns: Column<T>[]; t: (key: string, options?: any) => string }) {
  if (loading) return <SuperAdminLoading label={t('superAdmin.templates.loading')} />;
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t('superAdmin.templates.loadFailed', { message: error?.message || t('superAdmin.templates.unknownError') })}</div>;
  const rows = data || [];

  return (
    <SuperAdminTable>
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={tableHeadCellClass}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, idx) => (
            <tr key={idx} className={tableRowClass}>
              {columns.map((c) => (
                <td key={c.header} className={tableCellClass}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}><SuperAdminEmptyState title={t('superAdmin.templates.empty')} /></td>
            </tr>
          )}
        </tbody>
    </SuperAdminTable>
  );
}
