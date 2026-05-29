import React from 'react';
import VoucherTypesSettingsPage from '../../shared/pages/settings/VoucherTypesSettingsPage';

/**
 * Accounting Settings → Voucher Types page. Thin wrapper that pre-binds
 * the module to the shared VoucherTypesSettingsPage so the router can
 * lazy-load it with no module-specific props.
 */
const AccountingVoucherTypesSettingsPage: React.FC = () => (
  <VoucherTypesSettingsPage
    module="ACCOUNTING"
    moduleLabel="Accounting"
    formsDesignerPath="/accounting/forms-designer"
  />
);

export default AccountingVoucherTypesSettingsPage;
