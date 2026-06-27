/**
 * Voucher Wizard Test Page
 * 
 * Quick test page to demo the extracted Voucher Wizard.
 * Navigate to: /accounting/wizard-test
 */

import React from 'react';
import { VoucherFormDesigner, WizardProvider, VoucherFormConfig } from '../voucher-wizard';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from "react-i18next";

const VoucherWizardTestPage: React.FC = () => {
    const { t } = useTranslation('common');
  const handleVoucherSaved = (config: VoucherFormConfig) => {
    console.log('✅ Wizard completed! Output:', config);
    
    // Show the output in a success toast for quick verification
    errorHandler.showSuccess(
      `✅ Voucher Created!\n\n` +
      `Name: ${config.name}\n` +
      `ID: ${config.id}\n` +
      `Prefix: ${config.prefix}\n` +
      `Multi-line: ${config.isMultiLine ? 'Yes' : 'No'}\n` +
      `Fields: ${config.uiModeOverrides.windows.sections.HEADER.fields.length} header fields`
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Test Page Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">{t(`🧪 Voucher Wizard Test Page`)}</h1>
        <p className="text-blue-100 text-sm mt-1">
          This is a test page to verify the extracted Voucher Wizard UI.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-yellow-900 font-semibold mb-2">{t(`📝 Testing Instructions:`)}</h2>
          <ul className="text-yellow-800 text-sm space-y-1 list-disc list-inside">
            <li>{t(`Click "Create New Type" to open the wizard`)}</li>
            <li>{t(`Go through all 6 steps (Basic Info → Rules → Fields → Actions → Visual Editor → Review)`)}</li>
            <li>{t(`Try the drag-and-drop editor in Step 5`)}</li>
            <li>{t(`Click "Save & Close" to see the output`)}</li>
            <li>{t(`Check browser console for the full`)} <code>{t(`VoucherFormConfig`)}</code> {t(`object`)}</li>
          </ul>
        </div>
      </div>

      {/* Wizard Container */}
      <div className="flex-1 overflow-hidden">
        <WizardProvider>
          <VoucherFormDesigner 
            onVoucherSaved={handleVoucherSaved}
            onExit={() => console.log('Exit clicked')}
          />
        </WizardProvider>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 text-gray-300 p-3 text-center text-sm">
        <p>
          {t(`✅ Wizard extracted from`)} <code>{t(`Voucher-Wizard/`)}</code> folder • 
          📍 Location: <code>{t(`frontend/src/modules/accounting/voucher-wizard/`)}</code>
        </p>
      </div>
    </div>
  );
};

export default VoucherWizardTestPage;
