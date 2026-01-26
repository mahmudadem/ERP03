import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useVoucherTypeDefinition } from '../../../hooks/useVoucherTypeDefinition';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { DynamicVoucherRenderer } from '../../../designer-engine/components/DynamicVoucherRenderer';
import { accountingApi } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { AccountSelectorCombobox } from '../../../components/accounting/AccountSelectorCombobox';
import { RequirePermission } from '../../../components/auth/RequirePermission';
import { errorHandler } from '../../../services/errorHandler';
import { getCompanyToday } from '../../../utils/dateUtils';

const VoucherEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { settings: companySettings } = useCompanySettings();
  const typeCode = searchParams.get('type') || 'INV';
  const formId = searchParams.get('formId') || typeCode; // Use formId if provided, otherwise fall back to typeCode
  const { definition, loading: defLoading, error: defError } = useVoucherTypeDefinition(formId, companySettings?.companyId);
  
  const [initialValues, setInitialValues] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [currentVoucher, setCurrentVoucher] = useState<any>(null); 

  useEffect(() => {
    if (id && id !== 'new') {
      loadVoucherData(id);
    } else {
      // Re-initialize only if we're in 'new' mode and initialValues haven't been set with settings yet
      setInitialValues({
        header: {
           date: getCompanyToday(companySettings),
           currency: companySettings?.baseCurrency || ''
        },
        lines: [
          { accountId: '', description: '', debit: 0, credit: 0 },
          { accountId: '', description: '', debit: 0, credit: 0 }
        ]
      });
    }
  }, [id, companySettings]); // Now re-runs when settings arrive

  const loadVoucherData = async (voucherId: string) => {
    try {
      setDataLoading(true);
      const voucher = await accountingApi.getVoucher(voucherId);
      setCurrentVoucher(voucher);
      
      setInitialValues({
        header: {
          ...voucher,
          date: voucher.date,
          currency: voucher.currency || companySettings?.baseCurrency || '',
        },
        lines: voucher.lines || []
      });
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleSave = async (formData: any, statusOverride?: string) => {
    try {
      // For dynamic templates, we pass the formData directly to the backend.
      // The backend Strategy will handle line generation.
    const baseCurrency = companySettings?.baseCurrency || '';


      const payload = {
        ...formData, // Spread all dynamic fields (header fields, etc.)
        companyId: 'current',
        type: (definition as any).baseType || definition?.code || 'INV',
        formId: formId, // Store which form layout was used
        date: formData.header?.date || formData.date || new Date().toISOString(),
        currency: formData.header?.currency || formData.currency || companySettings?.baseCurrency || '',
        // Inject creationMode for audit transparency
        metadata: {
          ...formData.metadata,
          creationMode: companySettings?.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'
        },
        // If the template uses a lines table, include it. If not, it might be undefined.
        lines: formData.lines 
      };

      if (id === 'new') {
        const payloadWithStatus = {
          ...payload,
          status: statusOverride || 'draft'
        };
        const created = await accountingApi.createVoucher(payloadWithStatus);
        
        if (statusOverride === 'submitted') {
          await accountingApi.sendVoucherToApproval(created.id);
        }
        
        errorHandler.showSuccess('SAVE');
        navigate(`/accounting/vouchers/${created.id}`);
      } else {
        await accountingApi.updateVoucher(id!, payload);
        
        if (statusOverride === 'submitted') {
          await accountingApi.sendVoucherToApproval(id!);
        }
        
        errorHandler.showSuccess('SAVE');
        loadVoucherData(id!);
      }
    } catch (err: any) {
      errorHandler.showError(err);
    }
  };

  const handleWorkflowAction = async (action: 'sendToApproval' | 'approve' | 'lock' | 'cancel') => {
    if (!id || id === 'new') return;
    try {
      let updatedVoucher;
      switch (action) {
        case 'sendToApproval':
          updatedVoucher = await accountingApi.sendVoucherToApproval(id);
          errorHandler.showSuccess('Sent to Approval');
          break;
        case 'approve':
          updatedVoucher = await accountingApi.approveVoucher(id);
          errorHandler.showSuccess('Voucher Approved');
          break;
        case 'lock':
          updatedVoucher = await accountingApi.lockVoucher(id);
          errorHandler.showSuccess('Voucher Locked');
          break;
        case 'cancel':
          updatedVoucher = await accountingApi.cancelVoucher(id);
          errorHandler.showSuccess('Voucher Cancelled');
          break;
      }
      
      if (updatedVoucher) {
        setCurrentVoucher(updatedVoucher);
        setInitialValues((prev: any) => ({ ...prev, header: { ...prev.header, status: updatedVoucher.status } }));
      }
    } catch (err: any) {
      errorHandler.showError(err);
    }
  };

  if (defLoading || dataLoading || !initialValues || !companySettings) {
    return <div className="p-8 text-center text-gray-500">Loading editor...</div>;
  }

  if (defError || !definition) {
    return <div className="p-8 text-center text-red-500">Error: {defError || 'Definition not found'}</div>;
  }

  const renderStatusBadge = () => {
    if (!currentVoucher) return <Badge variant="info">New</Badge>;
    const map: Record<string, 'default' | 'warning' | 'success' | 'info' | 'error'> = {
      draft: 'default',
      pending: 'warning',
      approved: 'success',
      locked: 'info',
      cancelled: 'error'
    };
    return <Badge variant={map[currentVoucher.status] || 'default'}>{currentVoucher.status.toUpperCase()}</Badge>;
  };

  const renderActionButtons = () => {
    if (id === 'new' || !currentVoucher || !companySettings) return null;

    const status = currentVoucher.status;
    const isStrict = companySettings.strictApprovalMode;

    return (
      <div className="flex gap-2">
        {status === 'draft' && isStrict && (
          <RequirePermission permission="accounting.vouchers.edit">
            <Button onClick={() => handleWorkflowAction('sendToApproval')} variant="secondary" size="sm">
              Send for Approval
            </Button>
          </RequirePermission>
        )}
        
        {status === 'pending' && isStrict && (
          <>
            <RequirePermission permission="accounting.vouchers.approve">
              <Button onClick={() => handleWorkflowAction('approve')} variant="primary" size="sm">
                Approve
              </Button>
            </RequirePermission>
            <RequirePermission permission="accounting.vouchers.cancel">
              <Button onClick={() => handleWorkflowAction('cancel')} variant="danger" size="sm">
                Reject/Cancel
              </Button>
            </RequirePermission>
          </>
        )}

        {status === 'approved' && (
          <>
            <RequirePermission permission="accounting.vouchers.lock">
              <Button onClick={() => handleWorkflowAction('lock')} variant="secondary" size="sm">
                Lock
              </Button>
            </RequirePermission>
            <RequirePermission permission="accounting.vouchers.cancel">
              <Button onClick={() => handleWorkflowAction('cancel')} variant="danger" size="sm">
                Cancel
              </Button>
            </RequirePermission>
          </>
        )}
      </div>
    );
  };

  const isReadOnly = React.useMemo(() => {
    if (!currentVoucher?.status) return false;
    const status = currentVoucher.status.toLowerCase();
    
    // In STRICT mode, many statuses are read-only
    if (companySettings?.strictApprovalMode === true) {
      return ['posted', 'approved', 'locked'].includes(status);
    }
    
    // In SIMPLE mode (default), only locked is read-only
    return status === 'locked';
  }, [currentVoucher?.status, companySettings?.strictApprovalMode]);

  const customComponents = {
    'account-selector': AccountSelectorCombobox
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
           <div>
             <h1 className="text-xl font-bold text-gray-800">
               {id === 'new' ? `New ${definition.name}` : `${definition.name} #${id}`}
             </h1>
             <p className="text-xs text-gray-500 mt-1">
               {id !== 'new' && `Created by ${currentVoucher?.createdBy || 'System'}`}
             </p>
           </div>
           {renderStatusBadge()}

           {/* Status Indicator Dot - Visual Clue for Approval Mode */}
           <div className="group relative">
              <div 
                className={`w-2 h-2 rounded-full transition-all cursor-help ${
                  !companySettings ? 'bg-gray-400 animate-pulse' : 
                  (companySettings?.strictApprovalMode ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]')
                }`} 
              />
              <div className="absolute left-0 top-4 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded-md shadow-xl whitespace-nowrap z-50 border border-gray-700 font-normal">
                <div className="font-bold mb-1 border-b border-gray-600 pb-1">System Mode</div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-400">Policy:</span>
                  <span className={companySettings?.strictApprovalMode ? "text-indigo-300" : "text-emerald-300"}>
                    {companySettings?.strictApprovalMode ? 'Strict (Approval Required)' : 'Simple (Auto-Post)'}
                  </span>
                </div>
              </div>
           </div>
        </div>
        
        {renderActionButtons()}
      </div>

      <DynamicVoucherRenderer 
        definition={definition} 
        initialValues={initialValues}
        onSubmit={isReadOnly ? () => {} : handleSave}
        customComponents={customComponents} 
      />
      
      {isReadOnly && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded shadow-lg text-sm">
          This voucher is {currentVoucher.status} and cannot be edited.
        </div>
      )}
    </div>
  );
};

export default VoucherEditorPage;
