import React from 'react';
import VoucherDesignerPage from '../../shared/pages/VoucherDesignerPage';

/**
 * Sales Tools → Voucher Designer. Thin wrapper that pre-binds the module
 * to the shared VoucherDesignerPage so the router can lazy-load it.
 */
const SalesVoucherDesignerPage: React.FC = () => (
  <VoucherDesignerPage module="SALES" moduleLabel="Sales" />
);

export default SalesVoucherDesignerPage;
