import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherDesignerPage from '../../shared/pages/VoucherDesignerPage';

/**
 * Purchases Tools → Voucher Designer. Thin wrapper that pre-binds the
 * module to the shared VoucherDesignerPage so the router can lazy-load it.
 */
const PurchaseVoucherDesignerPage: React.FC = () => (
  <VoucherDesignerPage module="PURCHASE" moduleLabel="Purchases" />
);

export default PurchaseVoucherDesignerPage;
