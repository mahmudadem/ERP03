import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherDesignerPage from '../../shared/pages/VoucherDesignerPage';

/**
 * Accounting Tools → Voucher Designer. Thin wrapper that pre-binds the
 * module to the shared VoucherDesignerPage so the router can lazy-load it.
 */
const AccountingVoucherDesignerPage: React.FC = () => {
  const { t } = useTranslation('common');
  return <VoucherDesignerPage module="ACCOUNTING" moduleLabel={t('sidebar.accounting', 'Accounting')} />;
};

export default AccountingVoucherDesignerPage;
