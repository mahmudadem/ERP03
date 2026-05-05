import { useQuery } from '@tanstack/react-query';
import { superAdminTemplatesApi, WizardTemplateSummary, CoaTemplateSummary, CurrencySummary } from '../../../api/superAdminTemplates';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminSearchInput,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
  tableSortHeaderClass,
  SortIcon,
} from '../components/SuperAdminPage';
import { useSuperAdminTable } from '../hooks/useSuperAdminTable';
import { clsx } from 'clsx';

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
        <TemplateCard
          loading={wizardQuery.isLoading}
          error={wizardQuery.error as any}
          data={wizardQuery.data}
          t={t}
          title={t('superAdmin.templates.sections.wizardTemplates')}
          searchFields={['name', 'id']}
          columns={[
            { header: t('superAdmin.templates.columns.name'), render: (r: WizardTemplateSummary) => r.name, id: 'name' } as any,
            { header: t('superAdmin.templates.columns.models'), render: (r: WizardTemplateSummary) => (r.models || []).join(', ') || '-' },
            { header: t('superAdmin.templates.columns.id'), render: (r: WizardTemplateSummary) => r.id, id: 'id' } as any,
          ]}
        />
      </section>

      <section>
        <TemplateCard
          loading={coaQuery.isLoading}
          error={coaQuery.error as any}
          data={coaQuery.data}
          t={t}
          title={t('superAdmin.templates.sections.coaTemplates')}
          searchFields={['name', 'id']}
          columns={[
            { header: t('superAdmin.templates.columns.name'), render: (r: CoaTemplateSummary) => r.name, id: 'name' } as any,
            { header: t('superAdmin.templates.columns.id'), render: (r: CoaTemplateSummary) => r.id, id: 'id' } as any,
          ]}
        />
      </section>

      <section>
        <TemplateCard
          loading={currencyQuery.isLoading}
          error={currencyQuery.error as any}
          data={currencyQuery.data}
          t={t}
          title={t('superAdmin.templates.sections.currencies')}
          searchFields={['name', 'id']}
          columns={[
            { header: t('superAdmin.templates.columns.code'), render: (r: CurrencySummary) => r.id, id: 'id' } as any,
            { header: t('superAdmin.templates.columns.name'), render: (r: CurrencySummary) => r.name, id: 'name' } as any,
          ]}
        />
      </section>
    </SuperAdminPage>
  );
}

type Column<T> = { header: string; render: (row: T) => React.ReactNode };

function TemplateCard<T>({ loading, error, data, columns, t, searchFields, title }: { loading: boolean; error: any; data: T[] | undefined; columns: Column<T>[]; t: (key: string, options?: any) => string; searchFields: string[]; title: string }) {
  if (loading) return <SuperAdminLoading label={t('superAdmin.templates.loading')} />;
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t('superAdmin.templates.loadFailed', { message: error?.message || t('superAdmin.templates.unknownError') })}</div>;

  const {
    data: filteredData,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: data || [],
    searchFields,
    initialSort: { field: (columns[0] as any).id || '', direction: 'asc' },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <SuperAdminSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search ${title.toLowerCase()}...`}
          className="max-w-[240px]"
        />
      </div>
      <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.header}
                  className={clsx(tableHeadCellClass, (c as any).id && tableSortHeaderClass)}
                  onClick={() => (c as any).id && handleSort((c as any).id)}
                >
                  {c.header}
                  {(c as any).id && <SortIcon direction={sortConfig.field === (c as any).id ? sortConfig.direction : null} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredData.map((row, idx) => (
              <tr key={idx} className={tableRowClass}>
                {columns.map((c) => (
                  <td key={c.header} className={tableCellClass}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <SuperAdminEmptyState title={searchQuery ? "No results found" : t('superAdmin.templates.empty')} />
                </td>
              </tr>
            )}
          </tbody>
      </SuperAdminTable>
    </div>
  );
}
