/**
 * VoucherEditorPage — redirected to VoucherEntryModal
 *
 * This page no longer maintains its own editor. Instead, it:
 *   1. Loads the voucher & its form definition from the backend.
 *   2. Opens VoucherEntryModal (which uses GenericVoucherRenderer + formData).
 *   3. On close → navigates back to the vouchers list.
 *
 * For NEW vouchers (id === 'new'), creation happens from the vouchers list.
 * We redirect immediately.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useVoucherTypeDefinition } from '../../../hooks/useVoucherTypeDefinition';
import { accountingApi } from '../../../api/accountingApi';
import { VoucherEntryModal } from '../components/VoucherEntryModal';
import { canonicalToUi } from '../voucher-wizard/mappers/canonicalToUi';
import { UIMode } from '../../../api/companyApi';
import { errorHandler } from '../../../services/errorHandler';

const VoucherEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { settings } = useCompanySettings();

  const [voucher, setVoucher] = useState<any>(null);
  const [voucherLoading, setVoucherLoading] = useState(true);

  // Derive UIMode from company settings (same as VouchersListPage)
  const uiMode: UIMode = (settings as any)?.uiMode ?? 'WINDOWS';

  // Determine type code for definition lookup
  const formId = voucher?.formId || searchParams.get('formId') || '';
  const typeCode = voucher?.type || searchParams.get('type') || '';
  const lookupCode = formId || typeCode || 'journal_entry';

  // Use the canonical definition hook (multi-source lookup: designer API → form API → list)
  const { definition: canonicalDef, loading: defLoading } = useVoucherTypeDefinition(
    lookupCode,
    settings?.companyId
  );

  // Derive VoucherFormConfig from canonical definition
  const voucherFormConfig = React.useMemo(() => {
    if (!canonicalDef) return null;
    try {
      return canonicalToUi(canonicalDef as any);
    } catch {
      return null;
    }
  }, [canonicalDef]);

  // If id is 'new', redirect to the vouchers list where creation originates
  useEffect(() => {
    if (id === 'new') {
      navigate('/accounting/vouchers', { replace: true });
    }
  }, [id, navigate]);

  // Load voucher data
  useEffect(() => {
    if (!id || id === 'new') return;

    const load = async () => {
      try {
        setVoucherLoading(true);
        const data = await accountingApi.getVoucher(id);
        setVoucher(data);
      } catch (err: any) {
        errorHandler.showError(err);
        navigate('/accounting/vouchers', { replace: true });
      } finally {
        setVoucherLoading(false);
      }
    };

    load();
  }, [id]);

  const handleClose = () => {
    navigate('/accounting/vouchers');
  };

  const handleSave = async (data: any) => {
    if (!id || id === 'new') return;
    const updated = await accountingApi.updateVoucher(id, data);
    setVoucher(updated);
    return updated;
  };

  const handleApprove = async (voucherId: string) => {
    const updated = await accountingApi.approveVoucher(voucherId);
    setVoucher(updated);
  };

  const handleReject = async (voucherId: string) => {
    const updated = await accountingApi.rejectVoucher(voucherId, 'Rejected');
    setVoucher(updated);
  };

  const handlePost = async (voucherId: string) => {
    await accountingApi.postVoucher(voucherId);
    const updated = await accountingApi.getVoucher(voucherId);
    setVoucher(updated);
  };

  const handleCancel = async (voucherId: string) => {
    const updated = await accountingApi.cancelVoucher(voucherId);
    setVoucher(updated);
  };

  const handleReverse = async (voucherId: string) => {
    await accountingApi.reverseVoucher(voucherId);
    navigate('/accounting/vouchers');
  };

  const handlePrint = (voucherId: string) => {
    window.open(`/accounting/vouchers/${voucherId}/print`, '_blank');
  };

  const isLoading = voucherLoading || defLoading || !voucherFormConfig || !voucher;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading voucher…
      </div>
    );
  }

  return (
    <VoucherEntryModal
      isOpen={true}
      onClose={handleClose}
      voucherType={voucherFormConfig}
      uiMode={uiMode}
      onSave={handleSave}
      initialData={voucher}
      onApprove={handleApprove}
      onReject={handleReject}
      onPost={handlePost}
      onCancel={handleCancel}
      onReverse={handleReverse}
      onPrint={handlePrint}
    />
  );
};

export default VoucherEditorPage;
