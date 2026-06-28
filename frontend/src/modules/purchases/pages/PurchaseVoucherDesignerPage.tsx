import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherDesignerPage from '../../shared/pages/VoucherDesignerPage';

/**
 * Purchases Tools → Voucher Designer. Thin wrapper that pre-binds the
 * module to the shared VoucherDesignerPage so the router can lazy-load it.
 */
const PurchaseVoucherDesignerPage: React.FC = () => {
  const { t } = useTranslation('common');
  return <VoucherDesignerPage module="PURCHASE" moduleLabel={t('sidebar.purchases', 'Purchases')} />;
};

export default PurchaseVoucherDesignerPage;
