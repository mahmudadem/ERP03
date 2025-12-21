import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
}

export const StepReview: React.FC<Props> = ({ definition }) => {
  const columns = definition.tableColumns || [];

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );

  const Row = ({ label, value }: { label: string; value: string | number | boolean | undefined }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value?.toString() || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-6 p-4">
      <div className="border-b pb-4 mb-4 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Review & Save
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Verify the voucher configuration before saving.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Basic Information">
          <Row label="Name" value={definition.name} />
          <Row label="Code" value={definition.code} />
          <Row label="Module" value={definition.module} />
          <Row label="Schema Version" value={definition.schemaVersion || 2} />
        </Section>

        <Section title="Configuration">
          <Row label="Header Fields" value={definition.headerFields?.length || 0} />
          <Row label="Table Columns" value={columns.length} />
          <Row label="Required Posting Roles" value={definition.requiredPostingRoles?.length || 0} />
        </Section>
      </div>

      {columns.length > 0 && (
        <Section title="Table Columns">
          <div className="space-y-1">
            {columns.map(col => (
              <div key={col.fieldId} className="flex justify-between text-sm">
                <span className="text-gray-700">{col.fieldId}</span>
                <span className="text-gray-500">{col.width}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
        <strong>Schema V2:</strong> This definition is validated against canonical schema requirements.
        All fields must be properly classified before saving.
      </div>
    </div>
  );
};
