import React from 'react';
import VoucherDesignerPage from '../../shared/pages/VoucherDesignerPage';

/**
 * Accounting Tools → Voucher Designer. Thin wrapper that pre-binds the
 * module to the shared VoucherDesignerPage so the router can lazy-load it.
 */
const AccountingVoucherDesignerPage: React.FC = () => (
  <VoucherDesignerPage module="ACCOUNTING" moduleLabel="Accounting" />
);

export default AccountingVoucherDesignerPage;
