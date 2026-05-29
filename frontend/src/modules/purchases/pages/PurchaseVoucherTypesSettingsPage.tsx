import React from 'react';
import VoucherTypesSettingsPage from '../../shared/pages/settings/VoucherTypesSettingsPage';

/**
 * Purchases Settings → Voucher Types page. Thin wrapper that pre-binds
 * the module to the shared VoucherTypesSettingsPage so the router can
 * lazy-load it with no module-specific props.
 */
const PurchaseVoucherTypesSettingsPage: React.FC = () => (
  <VoucherTypesSettingsPage
    module="PURCHASE"
    moduleLabel="Purchases"
    formsDesignerPath="/tools/forms-designer"
  />
);

export default PurchaseVoucherTypesSettingsPage;
