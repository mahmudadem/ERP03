
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useVoucherTypeDefinition } from '../../../hooks/useVoucherTypeDefinition';
import { DynamicVoucherRenderer } from '../../../designer-engine/components/DynamicVoucherRenderer';
import { accountingApi } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

const VoucherEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const typeCode = searchParams.get('type') || 'INV';
  const { definition, loading: defLoading, error: defError } = useVoucherTypeDefinition(typeCode);
  
  const [initialValues, setInitialValues] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [currentVoucher, setCurrentVoucher] = useState<any>(null); // To store meta like status

  useEffect(() => {
    if (id && id !== 'new') {
      loadVoucherData(id);
    } else {
      setInitialValues({
        header: {
           date: new Date().toISOString(),
           currency: 'USD'
        },
        lines: []
      });
    }
  }, [id]);

  const loadVoucherData = async (voucherId: string) => {
    try {
      setDataLoading(true);
      const voucher = await accountingApi.getVoucher(voucherId);
      setCurrentVoucher(voucher);
      
      setInitialValues({
        header: {
          ...voucher,
          date: voucher.date,
          currency: voucher.currency || 'USD',
        },
        lines: voucher.lines || []
      });
    } catch (err) {
      console.error(err);
      alert('Failed to load voucher data');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      const payload = {
        companyId: 'cmp_123',
        type: definition?.code || 'INV',
        date: formData.date,
        currency: formData.currency || 'USD',
        lines: formData.items.map((item: any) => ({
           accountId: 'acc_123',
           description: item.description,
           fxAmount: Number(item.fxAmount || item.amount),
           costCenterId: null
        }))
      };

      if (id === 'new') {
        const created = await accountingApi.createVoucher(payload);
        alert('Voucher Created Successfully');
        navigate(`/accounting/vouchers/${created.id}`);
      } else {
        await accountingApi.updateVoucher(id!, payload);
        alert('Voucher Updated');
        loadVoucherData(id!); // Refresh state
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  // --- WORKFLOW ACTIONS ---

  const handleWorkflowAction = async (action: 'sendToApproval' | 'approve' | 'lock' | 'cancel') => {
    if (!id || id === 'new') return;
    try {
      let updatedVoucher;
      switch (action) {
        case 'sendToApproval':
          updatedVoucher = await accountingApi.sendVoucherToApproval(id);
          alert('Sent to Approval');
          break;
        case 'approve':
          updatedVoucher = await accountingApi.approveVoucher(id);
          alert('Voucher Approved');
          break;
        case 'lock':
          updatedVoucher = await accountingApi.lockVoucher(id);
          alert('Voucher Locked');
          break;
        case 'cancel':
          updatedVoucher = await accountingApi.cancelVoucher(id);
          alert('Voucher Cancelled');
          break;
      }
      
      if (updatedVoucher) {
        setCurrentVoucher(updatedVoucher);
        setInitialValues(prev => ({ ...prev, header: { ...prev.header, status: updatedVoucher.status } }));
      }
    } catch (err: any) {
      alert(`Action Failed: ${err.message}`);
    }
  };

  if (defLoading || dataLoading || !initialValues) {
    return <div className="p-8 text-center text-gray-500">Loading editor...</div>;
  }

  if (defError || !definition) {
    return <div className="p-8 text-center text-red-500">Error: {defError || 'Definition not found'}</div>;
  }

  // --- RENDER HELPERS ---

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
    if (id === 'new' || !currentVoucher) return null;

    const status = currentVoucher.status;

    return (
      <div className="flex gap-2">
        {status === 'draft' && (
          <Button onClick={() => handleWorkflowAction('sendToApproval')} variant="secondary" size="sm">
            Send for Approval
          </Button>
        )}
        {status === 'pending' && (
          <>
            <Button onClick={() => handleWorkflowAction('approve')} variant="primary" size="sm">
              Approve
            </Button>
            <Button onClick={() => handleWorkflowAction('cancel')} variant="danger" size="sm">
              Reject/Cancel
            </Button>
          </>
        )}
        {status === 'approved' && (
          <>
            <Button onClick={() => handleWorkflowAction('lock')} variant="secondary" size="sm">
              Lock
            </Button>
            <Button onClick={() => handleWorkflowAction('cancel')} variant="danger" size="sm">
              Cancel
            </Button>
          </>
        )}
        {/* Locked and Cancelled states have no actions */}
      </div>
    );
  };

  const isReadOnly = currentVoucher && (currentVoucher.status === 'locked' || currentVoucher.status === 'cancelled');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header Bar */}
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
        </div>
        
        {renderActionButtons()}
      </div>

      <DynamicVoucherRenderer 
        definition={definition} 
        initialValues={initialValues}
        onSubmit={isReadOnly ? () => {} : handleSave} // Disable submit if locked
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
