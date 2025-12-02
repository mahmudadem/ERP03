import { useQuery } from '@tanstack/react-query';
import { superAdminTemplatesApi, WizardTemplateSummary, CoaTemplateSummary, CurrencySummary } from '../../../api/superAdminTemplates';

export default function TemplatesPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Wizard templates, chart of accounts templates, and currencies.</p>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Wizard Templates</h2>
        <TemplateCard
          loading={wizardQuery.isLoading}
          error={wizardQuery.error as any}
          data={wizardQuery.data}
          columns={[
            { header: 'Name', render: (r) => r.name },
            { header: 'Models', render: (r) => (r.models || []).join(', ') || '-' },
            { header: 'ID', render: (r) => r.id },
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Chart of Accounts Templates</h2>
        <TemplateCard
          loading={coaQuery.isLoading}
          error={coaQuery.error as any}
          data={coaQuery.data}
          columns={[
            { header: 'Name', render: (r) => r.name },
            { header: 'ID', render: (r) => r.id },
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Currencies</h2>
        <TemplateCard
          loading={currencyQuery.isLoading}
          error={currencyQuery.error as any}
          data={currencyQuery.data}
          columns={[
            { header: 'Code', render: (r) => r.id },
            { header: 'Name', render: (r) => r.name },
          ]}
        />
      </section>
    </div>
  );
}

type Column<T> = { header: string; render: (row: T) => React.ReactNode };

function TemplateCard<T>({ loading, error, data, columns }: { loading: boolean; error: any; data: T[] | undefined; columns: Column<T>[] }) {
  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error) return <div className="text-sm text-red-600">Failed to load: {error?.message || 'Unknown error'}</div>;
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
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
