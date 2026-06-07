import React from 'react';
import VoucherTypesSettingsPage from '../../shared/pages/settings/VoucherTypesSettingsPage';

/**
 * Sales Settings → Voucher Types page. Thin wrapper that pre-binds
 * the module to the shared VoucherTypesSettingsPage so the router can
 * lazy-load it with no module-specific props.
 */
const SalesVoucherTypesSettingsPage: React.FC = () => (
  <VoucherTypesSettingsPage
    module="SALES"
    moduleLabel="Sales"
    formsDesignerPath="/tools/forms-designer"
  />
);

export default SalesVoucherTypesSettingsPage;
