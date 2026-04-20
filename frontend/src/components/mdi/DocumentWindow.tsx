import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Send, Loader2, CheckCircle, XCircle, Printer } from 'lucide-react';
import { UIWindow, useWindowManager } from '../../context/WindowManagerContext';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from '../../modules/accounting/components/shared/GenericVoucherRenderer';
import { MdiWindowFrame } from './MdiWindowFrame';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { InventoryItemDTO, UomConversionDTO, inventoryApi } from '../../api/inventoryApi';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption } from '../../modules/inventory/utils/uomOptions';

interface DocumentWindowProps {
  win: UIWindow;
  onSalesAction?: any;
  onPurchasesAction?: any;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

export const DocumentWindow: React.FC<DocumentWindowProps> = ({ win, onSalesAction, onPurchasesAction }) => {
  const { closeWindow, updateWindowData } = useWindowManager();
  const { t } = useTranslation('common');
  
  const rendererRef = useRef<GenericVoucherRendererRef>(null);
  const { settings } = useCompanySettings();

  // State
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const isInitialLoadRef = useRef(true);

  // Detect Document Type with normalization
  const getDocType = () => {
    const raw = win.data?.docType || win.data?.type || win.data?.voucherConfig?.code || 'DOC';
    const normalized = String(raw).toUpperCase().replace(/-/g, '_');
    
    // Mapping for common dynamic form codes
    if (normalized.includes('SALES_INVOICE') || normalized === 'SI') return 'SI';
    if (normalized.includes('SALES_ORDER') || normalized === 'SO') return 'SO';
    if (normalized.includes('DELIVERY_NOTE') || normalized === 'DN') return 'DN';
    if (normalized.includes('SALES_RETURN') || normalized === 'SR') return 'SR';
    if (normalized.includes('PURCHASE_INVOICE') || normalized === 'PI') return 'PI';
    if (normalized.includes('PURCHASE_ORDER') || normalized === 'PO') return 'PO';
    if (normalized.includes('GOODS_RECEIPT') || normalized === 'GRN') return 'GRN';
    if (normalized.includes('PURCHASE_RETURN') || normalized === 'PR') return 'PR';
    
    return normalized;
  };

  const docType = getDocType();
  const status = win.data?.status || 'DRAFT';
  const isDraft = status.toUpperCase() === 'DRAFT';
  const isPostedOrConfirmed = ['POSTED', 'CONFIRMED', 'FULLY_DELIVERED', 'FULLY_RECEIVED', 'CLOSED'].includes(status.toUpperCase());
  const isReadOnly = isPostedOrConfirmed;

  useEffect(() => {
    setIsDirty(false);
    isInitialLoadRef.current = true;

    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 600);

    return () => clearTimeout(timer);
  }, [
    win.data?.id,
    win.data?.updatedAt,
    win.data?.status,
    win.data?.invoiceNumber,
    win.data?.orderNumber,
    win.data?.dnNumber,
    win.data?.returnNumber,
  ]);

  const handleRendererChange = useCallback((nextData: any) => {
    if (!nextData) return;
    if (isInitialLoadRef.current || isReadOnly) return;
    setIsDirty(true);
  }, [isReadOnly]);

  const handleAction = async (actionFn: (id: string) => Promise<any>, actionName: string) => {
    let currentId = win.data?.id;
    
    // Auto-save if new or dirty
    if (!currentId || isDirty) {
      const savedDoc = await handleSave();
      if (!savedDoc) return; // Save failed
      currentId = savedDoc.id;
    }

    if (!currentId) return;

    setBusy(true);
    try {
      const result = await actionFn(currentId);
      if (result) {
        updateWindowData(win.id, { ...win.data, ...result });
        // Dispatch global event for list updates
        globalThis.window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: docType } }));
      }
    } catch (err) {
      // Error handled by hook
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!rendererRef.current) return null;
    
    const formData = rendererRef.current.getData();
    const id = win.data?.id;
    
    // Map generic 'date' field to specific backend requirements if they are missing
    const genericDate = formData.date;
    const payload = { ...formData };
    
    if (genericDate) {
      if (docType === 'SI' && !payload.invoiceDate) payload.invoiceDate = genericDate;
      if (docType === 'SO' && !payload.orderDate) payload.orderDate = genericDate;
      if (docType === 'DN' && !payload.deliveryDate) payload.deliveryDate = genericDate;
      if (docType === 'SR' && !payload.returnDate) payload.returnDate = genericDate;
      
      if (docType === 'PI' && !payload.invoiceDate) payload.invoiceDate = genericDate;
      if (docType === 'PO' && !payload.orderDate) payload.orderDate = genericDate;
      if (docType === 'GRN' && !payload.receiptDate) payload.receiptDate = genericDate;
      if (docType === 'PR' && !payload.returnDate) payload.returnDate = genericDate;
    }

    // Default required generic fields if they were visually loaded but didn't trigger onChange
    if (!payload.currency) payload.currency = formData.currency || settings?.baseCurrency || 'USD';
    if (payload.exchangeRate === undefined) {
      payload.exchangeRate = 1;
    } else {
      payload.exchangeRate = Number(payload.exchangeRate) || 1;
    }
    
    // Auto-map generic 'customer' and 'vendor' fields created via Global Designer
    const genericParty =
      formData.customerId ||
      formData.customer ||
      formData.customerName ||
      formData.vendorId ||
      formData.vendor ||
      formData.vendorName ||
      formData.partyId ||
      formData.accountId ||
      formData.account;
    if (genericParty) {
      if (['SI', 'SO', 'DN', 'SR'].includes(docType) && !payload.customerId) {
        payload.customerId = formData.customerId || formData.customer || formData.customerName || genericParty;
      }
      if (['PI', 'PO', 'GRN', 'PR'].includes(docType) && !payload.vendorId) {
        payload.vendorId = formData.vendorId || formData.vendor || formData.vendorName || genericParty;
      }
    }

    if (['SI', 'SO', 'DN', 'SR', 'PI', 'PO', 'GRN', 'PR'].includes(docType) && !payload.notes) {
      payload.notes = formData.notes || formData.description || undefined;
    }

    [
      'documentId',
      'voucherNumber',
      'voucherNo',
      'status',
      'createdAt',
      'createdBy',
      'updatedAt',
      'updatedBy',
      'salesOrderReference',
      'soReference',
      'subtotalDoc',
      'subtotalBase',
      'taxTotalDoc',
      'taxTotalBase',
      'grandTotalDoc',
      'grandTotalBase',
      'beforeDiscountDoc',
      'beforeDiscountBase',
      'grossTotalDoc',
      'grossTotalBase',
      'totalAmount'
    ].forEach((field) => {
      delete payload[field];
    });

    if (docType === 'SI') {
      delete payload.orderDate;
    }

    // Recover non-accounting lines (Sales/Purchases) which are otherwise filtered out by GenericVoucherRenderer
    const rawLines = (formData.sourcePayload?.lines || formData.lines || []) as any[];
    
    // Filter out completely empty lines to prevent backend validation noise (5 empty lines is default)
    const validLines = rawLines.filter(l => {
      const idStr = String(l.itemId || l.item || l.itemCode || l.itemSelector || l.account || l.accountId || l.accountSelector || '');
      return idStr.trim().length > 0;
    });

    // Auto-map generic line fields
    const mappedLines = validLines.map((line: any) => {
      const mapped = { ...line };
      
      // Robust item ID mapping - be extremely aggressive with fallbacks
      if (!mapped.itemId) {
        mapped.itemId = 
          line.itemId || line.item || line.itemCode || line.itemSelector || 
          line.product || line.productId || line.product_id || line.sku ||
          line.account || line.accountId || line.accountSelector || 
          line.account_id || line.account_code ||
          line.code;
      }
      
      // Warehouse mapping - avoid empty strings
      if (!mapped.warehouseId) {
        mapped.warehouseId = 
          line.warehouse || line.warehouseId || line.warehouseSelector || 
          line.warehouse_id || line.store || line.storeId ||
          payload.warehouseId || formData.warehouseId || undefined;
      }

      // Ensure we don't send empty strings for IDs
      if (!mapped.itemId) delete mapped.itemId;
      if (!mapped.warehouseId) delete mapped.warehouseId;
      
      if (docType === 'SI' || docType === 'PI' || docType === 'DN' || docType === 'SR' || docType === 'GRN' || docType === 'PR') {
        const rawQty = Number(line.qty || line.quantity || line.invoicedQty || line.orderedQty || line.deliveredQty || line.receivedQty || line.amount || 0);
        const qty = rawQty > 0 ? rawQty : 1; // Default to 1 if missing/invalid to satisfy backend
        
        if (mapped.invoicedQty === undefined) mapped.invoicedQty = qty;
        if (mapped.deliveredQty === undefined) mapped.deliveredQty = qty;
        if (mapped.receivedQty === undefined) mapped.receivedQty = qty;
        if (mapped.returnQty === undefined) mapped.returnQty = qty;
        
        const price = Number(line.price || line.unitPrice || line.unitPriceDoc || line.cost || line.unitCost || line.unitCostDoc || 0);
        if (mapped.unitPriceDoc === undefined) mapped.unitPriceDoc = price;
        if (mapped.unitCostDoc === undefined) mapped.unitCostDoc = price;
      }
      
      if (docType === 'SO' || docType === 'PO') {
        const rawQty = Number(line.qty || line.quantity || line.orderedQty || line.invoicedQty || 0);
        const qty = rawQty > 0 ? rawQty : 1;
        if (mapped.orderedQty === undefined) mapped.orderedQty = qty;
        
        const price = Number(line.price || line.unitPrice || line.unitPriceDoc || 0);
        if (mapped.unitPriceDoc === undefined) mapped.unitPriceDoc = price;
      }
      
      return mapped;
    });

    const uomUsage = ['SI', 'SO', 'DN', 'SR'].includes(docType) ? 'sales' : 'purchase';
    const itemIds = Array.from(
      new Set(
        mappedLines
          .map((line: any) => String(line.itemId || '').trim())
          .filter(Boolean)
      )
    );
    const itemContexts = new Map<string, { item: InventoryItemDTO; options: ReturnType<typeof buildItemUomOptions> }>();

    await Promise.all(
      itemIds.map(async (itemId) => {
        try {
          const itemResult = await inventoryApi.getItem(itemId);
          const item = unwrap<InventoryItemDTO | null>(itemResult);
          if (!item) return;

          let options = buildItemUomOptions(item, []);
          try {
            const conversionResult = await inventoryApi.listUomConversions(itemId);
            const conversions = unwrap<UomConversionDTO[]>(conversionResult) || [];
            options = buildItemUomOptions(item, conversions);
          } catch (conversionError) {
            console.error('Failed to load UOM conversions for document save', conversionError);
          }

          itemContexts.set(itemId, { item, options });
        } catch (itemError) {
          console.error('Failed to load item for document save', itemError);
        }
      })
    );

    payload.lines = mappedLines.map((line: any) => {
      const mapped = { ...line };
      const itemId = String(mapped.itemId || '').trim();
      const context = itemContexts.get(itemId);

      if (typeof mapped.uomId === 'string') {
        mapped.uomId = mapped.uomId.trim() || undefined;
      }

      if (typeof mapped.uom === 'string') {
        mapped.uom = mapped.uom.trim().toUpperCase();
      }

      if (context) {
        const selected =
          findItemUomOption(context.options, mapped.uomId, mapped.uom) ||
          getDefaultItemUomOption(context.item, uomUsage);

        if (selected?.uomId) {
          mapped.uomId = selected.uomId;
        } else {
          delete mapped.uomId;
        }

        mapped.uom = selected?.code || mapped.uom || context.item.baseUom || 'EA';
      } else if (!mapped.uom && itemId) {
        mapped.uom = 'EA';
      }

      if (!mapped.uomId) delete mapped.uomId;
      if (!mapped.uom) delete mapped.uom;
      return mapped;
    });
    
    setBusy(true);
    try {
      let result: any;
      
      // Determine the correct Save API based on docType
      if (docType === 'SI') {
        result = id ? await onSalesAction.updateInvoice(id, payload) : await onSalesAction.createInvoice(payload);
      } else if (docType === 'SO') {
        result = id ? await onSalesAction.updateOrder(id, payload) : await onSalesAction.createOrder(payload);
      } else if (docType === 'DN') {
        result = id ? win.data : await onSalesAction.createDeliveryNote(payload); // DN usually doesn't have update
      } else if (docType === 'SR') {
        result = id ? win.data : await onSalesAction.createReturn(payload);
      } else if (docType === 'PI') {
        result = id ? await onPurchasesAction.updateInvoice(id, payload) : await onPurchasesAction.createInvoice(payload);
      } else if (docType === 'PO') {
        result = id ? await onPurchasesAction.updateOrder(id, payload) : await onPurchasesAction.createOrder(payload);
      } else if (docType === 'GRN') {
        result = id ? await onPurchasesAction.updateReceipt(id, payload) : await onPurchasesAction.createReceipt(payload);
      } else if (docType === 'PR') {
        result = id ? await onPurchasesAction.updateReturn(id, payload) : await onPurchasesAction.createReturn(payload);
      }

      if (result) {
        // If it was a new doc, we might have a new ID now
        const updatedData = { ...win.data, ...result };
        updateWindowData(win.id, updatedData);
        setIsDirty(false);
        return updatedData;
      }
      return null;
    } catch (error: any) {
      // Error handled by hook
      return null;
    } finally {
      setBusy(false);
    }
  };

  const HeaderBadges = () => (
    <>
      {status && (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
          isPostedOrConfirmed ? 'bg-success-100/80 text-success-700' :
          isDraft ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' :
          status.toLowerCase() === 'pending' ? 'bg-amber-100/80 text-amber-700' :
          status.toLowerCase() === 'cancelled' ? 'bg-danger-100/80 text-danger-700' :
          'bg-primary-100/80 text-primary-700'
        }`}>
          {status}
        </span>
      )}
      {isDirty && !isReadOnly && (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-amber-100/80 text-amber-700 border border-amber-200">
          Unsaved
        </span>
      )}
    </>
  );

  const FooterActions = () => {
    // Left side: Secondary actions
    const secondaryActions = (
      <div className="flex items-center gap-2">
        {win.data?.id && (
           <button
             onClick={() => window.dispatchEvent(new CustomEvent('print-voucher', { detail: { voucher: win.data, formType: docType } }))}
             className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
             title={t('print')}
           >
             <Printer className="w-4 h-4" />
           </button>
        )}
      </div>
    );

    // Right side: Main actions
    const mainActions = (
      <div className="flex items-center gap-2">
        {/* Save Button */}
        {isDraft && (
          <button
            onClick={handleSave}
            disabled={busy || !isDirty}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {win.data?.id ? t('saveChanges') : t('createDraft')}
          </button>
        )}

        {/* Sales Invoice Actions */}
        {docType === 'SI' && isDraft && onSalesAction?.postInvoice && (
          <button
            onClick={() => handleAction(onSalesAction.postInvoice, 'Post Invoice')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Post Invoice
          </button>
        )}

        {/* Purchase Invoice Actions */}
        {docType === 'PI' && isDraft && onPurchasesAction?.postInvoice && (
          <button
            onClick={() => handleAction(onPurchasesAction.postInvoice, 'Post Invoice')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Post Invoice
          </button>
        )}

        {/* Sales Order Actions */}
        {docType === 'SO' && isDraft && onSalesAction?.confirmOrder && (
          <button
            onClick={() => handleAction(onSalesAction.confirmOrder, 'Confirm Order')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Confirm Order
          </button>
        )}
        {docType === 'SO' && status === 'CONFIRMED' && onSalesAction?.cancelOrder && (
          <button
            onClick={() => handleAction(onSalesAction.cancelOrder, 'Cancel Order')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 rounded-lg hover:bg-danger-100 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Cancel Order
          </button>
        )}

        {/* Delivery Note Actions */}
        {docType === 'DN' && isDraft && onSalesAction?.postDeliveryNote && (
          <button
            onClick={() => handleAction(onSalesAction.postDeliveryNote, 'Post Delivery Note')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Post DN
          </button>
        )}

        {/* Sales Return Actions */}
        {docType === 'SR' && isDraft && onSalesAction?.postReturn && (
          <button
            onClick={() => handleAction(onSalesAction.postReturn, 'Post Return')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Post Return
          </button>
        )}

        {/* Purchase Order Actions */}
        {docType === 'PO' && isDraft && onPurchasesAction?.confirmOrder && (
          <button
            onClick={() => handleAction(onPurchasesAction.confirmOrder, 'Confirm Order')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Confirm Order
          </button>
        )}
        {docType === 'PO' && status === 'CONFIRMED' && onPurchasesAction?.cancelOrder && (
          <button
            onClick={() => handleAction(onPurchasesAction.cancelOrder, 'Cancel Order')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 rounded-lg hover:bg-danger-100 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Cancel Order
          </button>
        )}

        {/* Goods Receipt Actions */}
        {docType === 'GRN' && isDraft && onPurchasesAction?.postReceipt && (
          <button
            onClick={() => handleAction(onPurchasesAction.postReceipt, 'Post Receipt')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Post Receipt
          </button>
        )}
        {docType === 'GRN' && isPostedOrConfirmed && onPurchasesAction?.unpostReceipt && (
          <button
            onClick={() => handleAction(onPurchasesAction.unpostReceipt, 'Unpost Receipt')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 rounded-lg hover:bg-danger-100 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Unpost Receipt
          </button>
        )}

        {/* Purchase Return Actions */}
        {docType === 'PR' && isDraft && onPurchasesAction?.postReturn && (
          <button
            onClick={() => handleAction(onPurchasesAction.postReturn, 'Post Return')}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Post Return
          </button>
        )}
        {docType === 'PR' && isPostedOrConfirmed && onPurchasesAction?.unpostReturn && (
          <button
            onClick={() => handleAction(onPurchasesAction.unpostReturn, 'Unpost Return')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 rounded-lg hover:bg-danger-100 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Unpost Return
          </button>
        )}

        {/* Unpost PI Actions */}
        {docType === 'PI' && isPostedOrConfirmed && onPurchasesAction?.unpostInvoice && (
          <button
            onClick={() => handleAction(onPurchasesAction.unpostInvoice, 'Unpost Invoice')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 rounded-lg hover:bg-danger-100 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Unpost Invoice
          </button>
        )}
      </div>
    );

    return (
      <>
        {secondaryActions}
        {mainActions}
      </>
    );
  };

  const title = win.data?.id
    ? `${win.title} - ${win.data?.invoiceNumber || win.data?.orderNumber || win.data?.dnNumber || win.data?.returnNumber || win.data?.id}`
    : (win.title.startsWith('New ') ? win.title : `New ${win.title}`);

  return (
    <MdiWindowFrame
      win={win}
      title={title}
      onClose={() => {
        if (isDirty) {
          setShowUnsavedModal(true);
        } else {
          closeWindow(win.id);
        }
      }}
      headerExtra={HeaderBadges()}
      footer={FooterActions()}
    >
      <GenericVoucherRenderer
        ref={rendererRef}
        definition={win.data?.voucherConfig as any}
        mode="windows"
        initialData={win.data}
        onChange={handleRendererChange}
        readOnly={isReadOnly}
      />
      
      <ConfirmDialog
        isOpen={showUnsavedModal}
        title={t('unsavedChanges')}
        message={t('unsavedChangesMsg')}
        onCancel={() => setShowUnsavedModal(false)}
        onConfirm={() => closeWindow(win.id)}
        confirmLabel={t('discard')}
        cancelLabel={t('cancel')}
        tone="danger"
      />
    </MdiWindowFrame>
  );
};
