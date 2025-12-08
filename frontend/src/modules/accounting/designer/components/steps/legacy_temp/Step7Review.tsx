import React from 'react';
import { VoucherTypeConfig, Translation } from '../../../types';

interface Props {
    config: VoucherTypeConfig;
    onSave: () => void;
    onBack: () => void;
    t: Translation;
}

const Step7Review: React.FC<Props> = ({ config, onSave, onBack, t }) => {
    const lang = (t.language || 'en') as 'ar' | 'en' | 'tr';

    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );

    const Row = ({ label, value }: { label: string, value: string | number | boolean | undefined }) => (
        <div className="flex justify-between py-2 border-b dark:border-gray-700 last:border-0">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="font-medium text-gray-900 dark:text-white">{value?.toString() || '-'}</span>
        </div>
    );

    return (
        <div className="space-y-6 p-4">
            <div className="border-b pb-4 mb-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.reviewAndSave || 'Review & Save'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.reviewDesc || 'Please review your configuration before saving.'}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title={t.basicInformation || 'Basic Information'}>
                    <Row label={t.name || 'Name'} value={config.name[lang]} />
                    <Row label={t.code || 'Code'} value={config.code} />
                    <Row label={t.abbreviation || 'Abbreviation'} value={config.abbreviation} />
                    <Row label={t.category || 'Category'} value={config.category} />
                    <Row label={t.mode || 'Mode'} value={config.mode === 'multiLine' ? 'Multi-line' : 'Single-line'} />
                    <Row label={t.status || 'Status'} value={config.isActive ? 'Active' : 'Inactive'} />
                </Section>

                <Section title={t.rulesAndApproval || 'Rules & Approval'}>
                    <Row label={t.autoNumbering || 'Auto Numbering'} value={config.rules?.autoNumbering ? 'Yes' : 'No'} />
                    <Row label={t.format || 'Format'} value={config.rules?.numberingFormat} />
                    <Row label={t.requiresApproval || 'Requires Approval'} value={config.rules?.requiresApproval ? 'Yes' : 'No'} />
                    {config.rules?.requiresApproval && (
                        <Row label={t.approvalLevels || 'Approval Levels'} value={config.rules?.approvalLevels} />
                    )}
                    <Row label={t.periodLock || 'Period Lock'} value={config.rules?.enforcePeriodLock ? 'Enforced' : 'Disabled'} />
                </Section>

                <Section title={t.fields || 'Fields'}>
                    <Row label={t.totalFields || 'Total Fields'} value={config.fields.length} />
                    <Row label={t.headerFields || 'Header Fields'} value={config.fields.filter(f => f.uiModeOverrides?.classic?.section === 'HEADER').length} />
                    <Row label={t.extraFields || 'Extra Fields'} value={config.fields.filter(f => f.uiModeOverrides?.classic?.section === 'EXTRA').length} />
                    {config.mode === 'multiLine' && (
                        <Row label={t.lineColumns || 'Line Columns'} value={config.lineFields?.length || 0} />
                    )}
                </Section>

                <Section title={t.actions || 'Actions'}>
                    <Row label={t.submit || 'Submit'} value={config.actions?.submit.enabled ? 'Enabled' : 'Disabled'} />
                    <Row label={t.approve || 'Approve'} value={config.actions?.approve.enabled ? 'Enabled' : 'Disabled'} />
                    <Row label={t.print || 'Print'} value={config.actions?.print.enabled ? 'Enabled' : 'Disabled'} />
                    <Row label={t.email || 'Email'} value={config.actions?.email.enabled ? 'Enabled' : 'Disabled'} />
                    <Row label={t.download || 'Download'} value={config.actions?.download.enabled ? 'Enabled' : 'Disabled'} />
                </Section>
            </div>

            <div className="flex justify-end pt-6">
                <button
                    onClick={onSave}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t.saveAndActivate || 'Save & Activate'}
                </button>
            </div>
        </div>
    );
};

export default Step7Review;
