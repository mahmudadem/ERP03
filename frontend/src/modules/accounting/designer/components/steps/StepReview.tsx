import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
}

export const StepReview: React.FC<Props> = ({ definition }) => {
  const fields = definition.headerFields || [];
  const columns = definition.tableFields || []; // Renamed from tableColumns

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
        <div className="p-4">
            {children}
        </div>
    </div>
  );

  const Row = ({ label, value }: { label: string, value: string | number | boolean | undefined }) => (
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
                Verify the voucher design before activating.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section title="Basic Information">
                <Row label="Name" value={definition.name} />
                <Row label="Code" value={definition.code} />
                <Row label="Abbreviation" value={definition.abbreviation} />
                <Row label="Mode" value={definition.mode === 'multi-line' ? 'Multi-line' : 'Single-line'} />
                <Row label="Status" value={definition.status === 'ACTIVE' ? 'Active' : 'DRAFT'} />
            </Section>

            <Section title="UI Elements">
                <Row label="Header Fields" value={fields.length} />
                <Row label="Custom Fields" value={definition.customFields?.length || 0} />
                <Row label="Active Header Fields" value={fields.map(f => f.label).join(', ')} />
                {definition.mode === 'multi-line' && (
                    <>
                        <Row label="Table Columns" value={columns.length} />
                        <Row label="Active Columns" value={columns.map(c => c.label).join(', ')} />
                    </>
                )}
            </Section>
        </div>
        
        <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
            <strong>Note:</strong> Numbering, Approval Rules, and Permissions are managed by the System Administrator in the backend configuration, not here.
        </div>
    </div>
  );
};
