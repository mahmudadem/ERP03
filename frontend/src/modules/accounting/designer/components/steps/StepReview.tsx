import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
}

export const StepReview: React.FC<Props> = ({ definition }) => {
  const metadata = definition.metadata || {};
  const workflow = definition.workflow || {};
  const actions = definition.actions || {};
  const fields = definition.headerFields || [];
  const columns = definition.tableColumns || [];

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
                Please review your configuration before saving.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section title="Basic Information">
                <Row label="Name" value={definition.name} />
                <Row label="Code" value={definition.code} />
                <Row label="Abbreviation" value={metadata.abbreviation} />
                <Row label="Category" value={definition.category} />
                <Row label="Mode" value={metadata.mode === 'multiLine' ? 'Multi-line' : 'Single-line'} />
                <Row label="Status" value={definition.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
            </Section>

            <Section title="Rules & Approval">
                <Row label="Auto Numbering" value={metadata.autoNumbering ? 'Yes' : 'No'} />
                <Row label="Format" value={metadata.numberingFormat} />
                <Row label="Requires Approval" value={workflow.approvalRequired ? 'Yes' : 'No'} />
                {workflow.approvalRequired && (
                    <Row label="Approval Levels" value={workflow.approvalLevels} />
                )}
                <Row label="Period Lock" value={metadata.enforcePeriodLock ? 'Enforced' : 'Disabled'} />
            </Section>

            <Section title="Fields">
                <Row label="Total Fields" value={fields.length} />
                <Row label="Header Fields" value={fields.filter(f => f.type !== 'LINE_ITEM').length} />
                {/* Simplified logic for header/extra fields as we don't have section info in definition yet */}
                {metadata.mode === 'multiLine' && (
                    <Row label="Line Columns" value={columns.length} />
                )}
            </Section>

            <Section title="Actions">
                <Row label="Submit" value={actions.submit?.enabled ? 'Enabled' : 'Disabled'} />
                <Row label="Approve" value={actions.approve?.enabled ? 'Enabled' : 'Disabled'} />
                <Row label="Print" value={actions.print?.enabled ? 'Enabled' : 'Disabled'} />
                <Row label="Email" value={actions.email?.enabled ? 'Enabled' : 'Disabled'} />
                <Row label="Download" value={actions.download?.enabled ? 'Enabled' : 'Disabled'} />
            </Section>
        </div>
    </div>
  );
};
