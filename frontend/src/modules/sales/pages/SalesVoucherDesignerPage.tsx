import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherDesignerPage from '../../shared/pages/VoucherDesignerPage';

/**
 * Sales Tools → Voucher Designer. Thin wrapper that pre-binds the module
 * to the shared VoucherDesignerPage so the router can lazy-load it.
 */
const SalesVoucherDesignerPage: React.FC = () => {
  const { t } = useTranslation('common');
  return <VoucherDesignerPage module="SALES" moduleLabel={t('sidebar.sales', 'Sales')} />;
};

export default SalesVoucherDesignerPage;
