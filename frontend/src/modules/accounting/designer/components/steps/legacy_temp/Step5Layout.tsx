import React from 'react';
import { VoucherTypeConfig, Translation } from '../../../types';
import SectionBasedLayoutDesigner from '../section-designer/SectionBasedLayoutDesigner';
import { AVAILABLE_FIELDS } from './constants';

interface Props {
    config: VoucherTypeConfig;
    updateConfig: (updates: Partial<VoucherTypeConfig>) => void;
    t: Translation;
}

const Step5Layout: React.FC<Props> = ({ config, updateConfig, t }) => {
    return (
        <div className="h-full flex flex-col">
            <div className="border-b pb-4 mb-4 dark:border-gray-700 px-4 pt-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.visualLayout || 'Visual Layout Preview'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.visualLayoutDesc || 'Preview and adjust the layout for Classic and Windows modes.'}
                </p>
            </div>
            
            <div className="flex-1 overflow-hidden">
                <SectionBasedLayoutDesigner 
                    config={config} 
                    updateConfig={updateConfig} 
                    availableFields={AVAILABLE_FIELDS} 
                    t={t} 
                />
            </div>
        </div>
    );
};

export default Step5Layout;
